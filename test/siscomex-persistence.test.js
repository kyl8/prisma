import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createSiscomexSnapshot } from "../src/integrations/siscomex/snapshot.js"
import { SqliteOperationalCaseRepository } from "../src/repositories/sqlite-operational-case-repository.js"
import { OperationalCaseService } from "../src/services/operational-case-service.js"

test("SQLite keeps Siscomex snapshots immutable, historical and idempotent", () => {
  const directory = mkdtempSync(join(tmpdir(), "prisma-siscomex-"))
  const repository = new SqliteOperationalCaseRepository({
    databasePath: join(directory, "prisma.db"),
  })
  try {
    new OperationalCaseService({ repository }).createCase({ id: "case-snapshot" })
    const common = {
      caseId: "case-snapshot",
      productId: "product-1",
      subsystem: "CATP",
      environment: "validation",
      resourceType: "PRODUCT",
      resourceKey: "12345678:0000000001:1",
      externalProductCode: "0000000001",
      externalVersion: "1",
      fetchedAt: "2026-01-01T00:00:00Z",
    }
    const first = createSiscomexSnapshot(
      { ...common, payload: { codigo: 1, versao: "1" } },
      { id: "snapshot-1", timestamp: "2026-01-01T00:00:00Z" },
    )
    assert.equal(repository.saveSiscomexSnapshot(first).id, "snapshot-1")
    const duplicate = createSiscomexSnapshot(
      { ...common, payload: { codigo: 1, versao: "1" } },
      { id: "snapshot-duplicate", timestamp: "2026-01-01T00:05:00Z" },
    )
    assert.equal(repository.saveSiscomexSnapshot(duplicate).id, "snapshot-1")
    const changed = createSiscomexSnapshot(
      { ...common, payload: { codigo: 1, versao: "1.1" } },
      { id: "snapshot-2", timestamp: "2026-01-02T00:00:00Z" },
    )
    repository.saveSiscomexSnapshot(changed)
    assert.equal(repository.listSiscomexSnapshots({ caseId: "case-snapshot" }).length, 2)
    assert.throws(
      () => repository.database.prepare(
        "UPDATE siscomex_snapshots SET status = 'STALE' WHERE id = ?",
      ).run("snapshot-1"),
      /immutable/,
    )
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
