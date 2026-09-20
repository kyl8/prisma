import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, test } from "node:test"

import { CaseVersionConflictError, NotFoundError } from "../src/domain/shared/errors.js"
import { InMemoryOperationalCaseRepository } from "../src/repositories/in-memory-operational-case-repository.js"
import { SqliteOperationalCaseRepository } from "../src/repositories/sqlite-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "prisma-persistence-"))
  temporaryDirectories.push(directory)
  return join(directory, "prisma.db")
}

function harness(repository) {
  let sequence = 0
  let second = 0
  return new OperationalCaseService({
    repository,
    idFactory: () => `generated-${++sequence}`,
    clock: () => `2026-09-20T12:00:${String(second++).padStart(2, "0")}.000Z`,
  })
}

function completeFields(grossWeight = 700) {
  return {
    description: "Industrial Pump XP400",
    quantity: 10,
    grossWeight,
    manufacturer: "ABC Machinery",
    model: "XP400",
    ncm: "8413.x",
  }
}

function conflictingCase(service, id = "case-lifecycle") {
  const created = service.createCase({
    id,
    documents: [
      { id: `${id}-invoice`, type: "invoice", fields: completeFields(720) },
      { id: `${id}-packing`, type: "packing_list", fields: completeFields(680) },
    ],
    products: [{
      id: `${id}-product`,
      description: "Industrial Pump XP400",
      manufacturer: "ABC Machinery",
      model: "XP400",
      ncm: "8413.x",
      classificationEvidence: { type: "technical_sheet" },
    }],
  })
  return service.analyze(created.id)
}

test("migrations create a durable database that can be reopened", () => {
  const databasePath = temporaryDatabase()
  const first = new SqliteOperationalCaseRepository({ databasePath })
  const created = harness(first).createCase({ id: "case-persisted" })
  assert.equal(created.version, 1)
  assert.deepEqual(
    first.database.prepare("SELECT version FROM schema_migrations ORDER BY version").all(),
    [{ version: 1 }, { version: 2 }, { version: 3 }],
  )
  first.close()

  const second = new SqliteOperationalCaseRepository({ databasePath })
  assert.equal(second.findById("case-persisted").id, "case-persisted")
  assert.equal(second.list().length, 1)
  assert.throws(() => second.findById("missing"), NotFoundError)
  second.close()
})

test("repositories increment versions and prevent a lost update", () => {
  for (const repository of [
    new InMemoryOperationalCaseRepository(),
    new SqliteOperationalCaseRepository({ databasePath: ":memory:" }),
  ]) {
    const service = harness(repository)
    service.createCase({ id: "case-version" })
    const clientA = repository.findById("case-version")
    const clientB = repository.findById("case-version")
    clientA.metadata.owner = "A"
    const saved = repository.save(clientA, 1)
    assert.equal(saved.version, 2)
    clientB.metadata.owner = "B"
    assert.throws(
      () => repository.save(clientB, 1),
      (error) =>
        error instanceof CaseVersionConflictError &&
        error.expectedVersion === 1 &&
        error.currentVersion === 2,
    )
    assert.equal(repository.findById("case-version").metadata.owner, "A")
    repository.close?.()
  }
})

test("transactions roll back all intermediate writes", () => {
  const repository = new SqliteOperationalCaseRepository({ databasePath: ":memory:" })
  const service = harness(repository)
  assert.throws(() => repository.transaction(() => {
    service.createCase({ id: "case-rolled-back" })
    throw new Error("simulated intermediate failure")
  }), /simulated intermediate failure/)
  assert.throws(() => repository.findById("case-rolled-back"), NotFoundError)
  repository.close()
})

test("evidence and timeline rows are immutable while later evidence is preserved", () => {
  const repository = new SqliteOperationalCaseRepository({ databasePath: ":memory:" })
  const service = harness(repository)
  const result = conflictingCase(service, "case-ledger")
  const stored = repository.findById("case-ledger")
  const evidence = stored.evidences[0]
  const originalValue = evidence.value
  evidence.value = "tampered"
  assert.throws(() => repository.save(stored, stored.version), /immutable/)
  assert.equal(repository.findById("case-ledger").evidences[0].value, originalValue)

  const action = result.actions.find((item) => item.field === "grossWeight")
  service.resolveAction("case-ledger", action.id, {
    value: 700,
    source: { type: "manual", reference: "review" },
  })
  const after = repository.findById("case-ledger")
  assert.ok(after.evidences.some((item) => item.id === evidence.id))
  assert.ok(after.evidences.some((item) => item.value === 700))
  assert.throws(
    () => repository.database.prepare("UPDATE timeline_events SET type='ALTERED'").run(),
    /immutable/,
  )
  repository.close()
})

test("a corrected document adds superseding Evidence without deleting history", () => {
  const repository = new InMemoryOperationalCaseRepository()
  const service = harness(repository)
  const created = service.createCase({
    id: "case-supersession",
    documents: [{ id: "invoice-v1", type: "invoice", fields: completeFields(680) }],
    products: [{
      id: "product-supersession",
      ...completeFields(680),
      classificationEvidence: { type: "technical_sheet" },
    }],
  })
  service.analyze(created.id)
  const previous = repository.findById(created.id).evidences.find(
    (item) => item.source?.documentId === "invoice-v1" && item.field === "grossWeight",
  )
  service.ingest(created.id, {
    kind: "structured",
    document: {
      id: "invoice-v2",
      type: "invoice",
      metadata: { supersedesDocumentId: "invoice-v1" },
      fields: completeFields(700),
    },
  })
  service.analyze(created.id)
  const stored = repository.findById(created.id)
  const corrected = stored.evidences.find(
    (item) => item.source?.documentId === "invoice-v2" && item.field === "grossWeight",
  )
  assert.ok(stored.evidences.some((item) => item.id === previous.id))
  assert.equal(corrected.supersedes, previous.id)
  assert.ok(stored.timeline.some(
    (event) =>
      event.type === "EVIDENCE_SUPERSEDED" &&
      event.metadata.evidenceId === previous.id,
  ))
})

test("Action lifecycle records actors and replaces closed work for an open Finding", () => {
  const repository = new InMemoryOperationalCaseRepository()
  const service = harness(repository)
  let result = conflictingCase(service)
  const action = result.actions.find((item) => item.field === "grossWeight")
  result = service.startAction(result.caseId, action.id, {
    actor: { type: "USER", id: "broker-1", role: "BROKER" },
  })
  assert.equal(result.actions.find((item) => item.id === action.id).status, "IN_PROGRESS")
  result = service.cancelAction(result.caseId, action.id, {
    reason: "wrong assignee",
    actor: { type: "USER", id: "admin-1", role: "ADMIN" },
  })
  assert.equal(result.findings.find((item) => item.id === action.findingId).status, "OPEN")
  const replacements = result.actions.filter(
    (item) => item.findingId === action.findingId && item.status === "OPEN",
  )
  assert.equal(replacements.length, 1)
  assert.equal(replacements[0].predecessorActionId, action.id)
  assert.ok(result.timeline.some(
    (event) => event.type === "ACTION_CANCELLED" && event.actor.id === "admin-1",
  ))
  result = service.startAction(result.caseId, replacements[0].id, {
    actor: { type: "USER", id: "broker-1", role: "BROKER" },
  })
  result = service.resolveAction(result.caseId, replacements[0].id, {
    value: 700,
    source: { type: "manual", reference: "weighing-certificate" },
    actor: { type: "USER", id: "broker-1", role: "BROKER" },
  })
  assert.equal(
    result.actions.find((item) => item.id === replacements[0].id).status,
    "RESOLVED",
  )
})

test("Finding dismissal requires reason and actor and is distinct from resolution", () => {
  const service = harness(new InMemoryOperationalCaseRepository())
  const analyzed = conflictingCase(service, "case-dismiss")
  const finding = analyzed.findings.find((item) => item.field === "grossWeight")
  assert.throws(
    () => service.dismissFinding(analyzed.caseId, finding.id, { reason: "accepted" }),
    /Actor requires/,
  )
  const result = service.dismissFinding(analyzed.caseId, finding.id, {
    reason: "Accepted by compliance review",
    actor: { type: "USER", id: "admin-1", role: "ADMIN" },
  })
  const dismissed = result.findings.find((item) => item.id === finding.id)
  assert.equal(dismissed.status, "DISMISSED")
  assert.equal(dismissed.resolvedAt, null)
  assert.equal(dismissed.dismissedBy.id, "admin-1")
  assert.ok(result.timeline.some((event) => event.type === "FINDING_DISMISSED"))
})
