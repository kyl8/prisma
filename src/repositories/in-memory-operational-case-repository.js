import {
  CaseVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/shared/errors.js"
import { OperationalCaseRepository } from "./operational-case-repository.js"

const clone = (value) => structuredClone(value)

function assertAppendOnly(previous, next, collection, idField) {
  const previousById = new Map(
    (previous[collection] ?? []).map((record) => [
      record[idField],
      JSON.stringify(record),
    ]),
  )
  for (const record of next[collection] ?? []) {
    const serialized = previousById.get(record[idField])
    if (serialized !== undefined && serialized !== JSON.stringify(record)) {
      throw new ValidationError(`${collection} records are immutable`)
    }
  }
}

export class InMemoryOperationalCaseRepository extends OperationalCaseRepository {
  #cases = new Map()
  #siscomexSnapshots = new Map()
  #siscomexSyncRuns = new Map()
  #siscomexCache = new Map()

  create(operationalCase) {
    if (this.#cases.has(operationalCase.id)) {
      throw new ValidationError(`OperationalCase already exists: ${operationalCase.id}`)
    }
    const stored = { ...clone(operationalCase), version: 1 }
    this.#cases.set(stored.id, stored)
    return clone(stored)
  }

  save(operationalCase, expectedVersion = operationalCase.version) {
    const current = this.#cases.get(operationalCase.id)
    if (!current) throw new NotFoundError("OperationalCase", operationalCase.id)
    if (current.version !== expectedVersion) {
      throw new CaseVersionConflictError(
        operationalCase.id,
        expectedVersion,
        current.version,
      )
    }
    assertAppendOnly(current, operationalCase, "evidences", "id")
    assertAppendOnly(current, operationalCase, "timeline", "eventId")
    const stored = { ...clone(operationalCase), version: expectedVersion + 1 }
    this.#cases.set(stored.id, stored)
    return clone(stored)
  }

  findById(id) {
    const operationalCase = this.#cases.get(id)
    if (!operationalCase) throw new NotFoundError("OperationalCase", id)
    return clone(operationalCase)
  }

  list({ limit = 50, offset = 0 } = {}) {
    return [...this.#cases.values()]
      .slice(offset, offset + limit)
      .map(clone)
  }

  transaction(work) {
    const snapshot = new Map(
      [...this.#cases.entries()].map(([id, value]) => [id, clone(value)]),
    )
    const siscomexSnapshots = new Map(
      [...this.#siscomexSnapshots.entries()].map(([id, value]) => [id, clone(value)]),
    )
    const siscomexSyncRuns = new Map(
      [...this.#siscomexSyncRuns.entries()].map(([id, value]) => [id, clone(value)]),
    )
    const siscomexCache = new Map(this.#siscomexCache)
    try {
      return work()
    } catch (error) {
      this.#cases = snapshot
      this.#siscomexSnapshots = siscomexSnapshots
      this.#siscomexSyncRuns = siscomexSyncRuns
      this.#siscomexCache = siscomexCache
      throw error
    }
  }

  saveSiscomexSnapshot(snapshot) {
    const existing = this.listSiscomexSnapshots({
      caseId: snapshot.caseId,
      productId: snapshot.productId,
      subsystem: snapshot.subsystem,
      environment: snapshot.environment,
      resourceType: snapshot.resourceType,
      resourceKey: snapshot.resourceKey,
    }).find((item) => item.payloadHash === snapshot.payloadHash)
    const stored = existing ?? clone(snapshot)
    if (!existing) this.#siscomexSnapshots.set(snapshot.id, stored)
    this.#siscomexCache.set(this.#siscomexScope(snapshot), {
      snapshotId: stored.id,
      checkedAt: snapshot.fetchedAt,
    })
    return { ...clone(stored), cacheCheckedAt: snapshot.fetchedAt }
  }

  listSiscomexSnapshots(criteria = {}) {
    return [...this.#siscomexSnapshots.values()]
      .filter((snapshot) => Object.entries(criteria).every(
        ([key, value]) => value === undefined || snapshot[key] === value,
      ))
      .map((snapshot) => {
        const cache = this.#siscomexCache.get(this.#siscomexScope(snapshot))
        return {
          ...clone(snapshot),
          cacheCheckedAt: cache?.snapshotId === snapshot.id
            ? cache.checkedAt
            : null,
        }
      })
      .sort((left, right) =>
        (right.cacheCheckedAt ?? right.fetchedAt).localeCompare(
          left.cacheCheckedAt ?? left.fetchedAt,
        )
      )
  }

  findLatestSiscomexSnapshot(criteria = {}) {
    return this.listSiscomexSnapshots(criteria)[0] ?? null
  }

  saveSiscomexSyncRun(run) {
    this.#siscomexSyncRuns.set(run.id, clone(run))
    return clone(run)
  }

  listSiscomexSyncRuns(criteria = {}) {
    return [...this.#siscomexSyncRuns.values()]
      .filter((run) => Object.entries(criteria).every(
        ([key, value]) => value === undefined || run[key] === value,
      ))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map(clone)
  }

  #siscomexScope(snapshot) {
    return JSON.stringify([
      snapshot.caseId ?? null,
      snapshot.productId ?? null,
      snapshot.environment,
      snapshot.subsystem,
      snapshot.resourceType,
      snapshot.resourceKey,
    ])
  }
}
