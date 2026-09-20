import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

import Database from "better-sqlite3"

import {
  CaseVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../domain/shared/errors.js"
import { runMigrations } from "../persistence/migrations.js"
import { OperationalCaseRepository } from "./operational-case-repository.js"

const json = (value) => JSON.stringify(value ?? null)
const parse = (value, fallback = null) =>
  value === null || value === undefined ? fallback : JSON.parse(value)

function coreParameters(operationalCase) {
  return {
    id: operationalCase.id,
    status: operationalCase.status,
    version: operationalCase.version,
    metadata: json(operationalCase.metadata ?? {}),
    parties: json(operationalCase.parties ?? {}),
    shipment: json(operationalCase.shipment ?? {}),
    products: json(operationalCase.products ?? []),
    operationalMetrics: json(operationalCase.operationalMetrics ?? {}),
    readiness: json(operationalCase.readiness),
    decision: json(operationalCase.decision),
    catalogGovernance: json(operationalCase.catalogGovernance),
    divergences: json(operationalCase.divergences ?? []),
    missingFields: json(operationalCase.missingFields ?? []),
    risks: json(operationalCase.risks ?? []),
    decisions: json(operationalCase.decisions ?? []),
    resolvedFields: json(operationalCase.resolvedFields ?? {}),
    quantitativePrediction: json(operationalCase.quantitativePrediction),
    productIdentities: json(operationalCase.productIdentities ?? []),
    siscomex: json(operationalCase.siscomex ?? {}),
    idempotencyKeys: json(operationalCase.idempotencyKeys ?? {}),
    createdAt: operationalCase.createdAt,
    updatedAt: operationalCase.updatedAt,
    lastAnalyzedAt: operationalCase.lastAnalyzedAt ?? null,
  }
}

export class SqliteOperationalCaseRepository extends OperationalCaseRepository {
  constructor({ databasePath, readonly = false }) {
    super()
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true })
    this.database = new Database(databasePath, { readonly })
    this.database.pragma("foreign_keys = ON")
    if (!readonly) {
      this.database.pragma("journal_mode = WAL")
      runMigrations(this.database)
    }
  }

  create(operationalCase) {
    return this.#atomic(() => {
      const stored = { ...structuredClone(operationalCase), version: 1 }
      this.database
        .prepare(`
          INSERT INTO operational_cases (
            id, status, version, metadata_json, parties_json, shipment_json,
            products_json, operational_metrics_json, readiness_json,
            decision_json, catalog_governance_json, divergences_json,
            missing_fields_json, risks_json, decisions_json,
            resolved_fields_json, quantitative_prediction_json,
            product_identities_json, siscomex_state_json, idempotency_keys_json, created_at,
            updated_at, last_analyzed_at
          ) VALUES (
            @id, @status, @version, @metadata, @parties, @shipment,
            @products, @operationalMetrics, @readiness, @decision,
            @catalogGovernance, @divergences, @missingFields, @risks,
            @decisions, @resolvedFields, @quantitativePrediction,
            @productIdentities, @siscomex, @idempotencyKeys, @createdAt, @updatedAt,
            @lastAnalyzedAt
          )
        `)
        .run(coreParameters(stored))
      this.#persistRelated(stored)
      return this.findById(stored.id)
    })
  }

  save(operationalCase, expectedVersion = operationalCase.version) {
    return this.#atomic(() => {
      const current = this.database
        .prepare("SELECT version FROM operational_cases WHERE id = ?")
        .get(operationalCase.id)
      if (!current) throw new NotFoundError("OperationalCase", operationalCase.id)
      if (current.version !== expectedVersion) {
        throw new CaseVersionConflictError(
          operationalCase.id,
          expectedVersion,
          current.version,
        )
      }

      const stored = {
        ...structuredClone(operationalCase),
        version: expectedVersion + 1,
      }
      const result = this.database
        .prepare(`
          UPDATE operational_cases SET
            status=@status, version=@version, metadata_json=@metadata,
            parties_json=@parties, shipment_json=@shipment,
            products_json=@products, operational_metrics_json=@operationalMetrics,
            readiness_json=@readiness, decision_json=@decision,
            catalog_governance_json=@catalogGovernance,
            divergences_json=@divergences, missing_fields_json=@missingFields,
            risks_json=@risks, decisions_json=@decisions,
            resolved_fields_json=@resolvedFields,
            quantitative_prediction_json=@quantitativePrediction,
             product_identities_json=@productIdentities,
             siscomex_state_json=@siscomex,
            idempotency_keys_json=@idempotencyKeys, updated_at=@updatedAt,
            last_analyzed_at=@lastAnalyzedAt
          WHERE id=@id AND version=@expectedVersion
        `)
        .run({ ...coreParameters(stored), expectedVersion })
      if (result.changes !== 1) {
        const latest = this.database
          .prepare("SELECT version FROM operational_cases WHERE id = ?")
          .get(operationalCase.id)
        throw new CaseVersionConflictError(
          operationalCase.id,
          expectedVersion,
          latest?.version ?? null,
        )
      }
      this.#persistRelated(stored)
      return this.findById(stored.id)
    })
  }

  findById(id) {
    const row = this.database
      .prepare("SELECT * FROM operational_cases WHERE id = ?")
      .get(id)
    if (!row) throw new NotFoundError("OperationalCase", id)
    return {
      id: row.id,
      status: row.status,
      version: row.version,
      metadata: parse(row.metadata_json, {}),
      parties: parse(row.parties_json, {}),
      shipment: parse(row.shipment_json, {}),
      products: parse(row.products_json, []),
      operationalMetrics: parse(row.operational_metrics_json, {}),
      documents: this.#jsonRows("documents", "canonical_json", id),
      evidences: this.#jsonRows("evidences", "evidence_json", id),
      findings: this.#jsonRows("findings", "finding_json", id),
      actions: this.#jsonRows("actions", "action_json", id),
      timeline: this.database
        .prepare(
          "SELECT event_json FROM timeline_events WHERE case_id = ? ORDER BY timestamp, rowid",
        )
        .all(id)
        .map((item) => parse(item.event_json)),
      divergences: parse(row.divergences_json, []),
      missingFields: parse(row.missing_fields_json, []),
      risks: parse(row.risks_json, []),
      decisions: parse(row.decisions_json, []),
      resolvedFields: parse(row.resolved_fields_json, {}),
      catalogGovernance: parse(row.catalog_governance_json),
      readiness: parse(row.readiness_json),
      decision: parse(row.decision_json),
      quantitativePrediction: parse(row.quantitative_prediction_json),
      productIdentities: parse(row.product_identities_json, []),
      siscomex: parse(row.siscomex_state_json, {}),
      idempotencyKeys: parse(row.idempotency_keys_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAnalyzedAt: row.last_analyzed_at,
    }
  }

  list({ limit = 50, offset = 0 } = {}) {
    return this.database
      .prepare("SELECT id FROM operational_cases ORDER BY created_at LIMIT ? OFFSET ?")
      .all(limit, offset)
      .map(({ id }) => this.findById(id))
  }

  transaction(work) {
    return this.#atomic(work)
  }

  saveSiscomexSnapshot(snapshot) {
    this.database.prepare(`
      INSERT OR IGNORE INTO siscomex_snapshots (
        id, case_id, product_id, subsystem, environment, resource_type,
        resource_key, external_product_code, external_version,
        foreign_operator_code, ncm, payload_json, payload_hash, fetched_at,
        valid_from, valid_to, status, created_at
      ) VALUES (
        @id, @caseId, @productId, @subsystem, @environment, @resourceType,
        @resourceKey, @externalProductCode, @externalVersion,
        @foreignOperatorCode, @ncm, @payload, @payloadHash, @fetchedAt,
        @validFrom, @validTo, @status, @createdAt
      )
    `).run({ ...snapshot, payload: json(snapshot.payload) })
    const row = this.database.prepare(`
      SELECT * FROM siscomex_snapshots
      WHERE environment = @environment AND subsystem = @subsystem
        AND resource_type = @resourceType AND resource_key = @resourceKey
        AND payload_hash = @payloadHash
        AND COALESCE(case_id, '') = COALESCE(@caseId, '')
        AND COALESCE(product_id, '') = COALESCE(@productId, '')
      ORDER BY fetched_at DESC LIMIT 1
    `).get(snapshot)
    this.database.prepare(`
      INSERT INTO siscomex_cache_entries (scope_key, snapshot_id, checked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(scope_key) DO UPDATE SET
        snapshot_id=excluded.snapshot_id,
        checked_at=excluded.checked_at
    `).run(this.#siscomexScope(snapshot), row.id, snapshot.fetchedAt)
    return { ...this.#siscomexSnapshot(row), cacheCheckedAt: snapshot.fetchedAt }
  }

  listSiscomexSnapshots(criteria = {}) {
    const clauses = []
    const parameters = {}
    const columns = {
      caseId: "case_id",
      productId: "product_id",
      subsystem: "subsystem",
      environment: "environment",
      resourceType: "resource_type",
      resourceKey: "resource_key",
    }
    for (const [key, column] of Object.entries(columns)) {
      if (criteria[key] === undefined) continue
      clauses.push(`${column} IS @${key}`)
      parameters[key] = criteria[key]
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
    return this.database
      .prepare(`
        SELECT siscomex_snapshots.*, siscomex_cache_entries.checked_at AS cache_checked_at
        FROM siscomex_snapshots
        LEFT JOIN siscomex_cache_entries
          ON siscomex_cache_entries.snapshot_id = siscomex_snapshots.id
        ${where}
        ORDER BY COALESCE(siscomex_cache_entries.checked_at, fetched_at) DESC,
          siscomex_snapshots.rowid DESC
      `)
      .all(parameters)
      .map((row) => this.#siscomexSnapshot(row))
  }

  findLatestSiscomexSnapshot(criteria = {}) {
    return this.listSiscomexSnapshots(criteria)[0] ?? null
  }

  saveSiscomexSyncRun(run) {
    this.database.prepare(`
      INSERT INTO siscomex_sync_runs (
        id, case_id, product_id, sync_type, environment, status,
        resource_count, cache_status, error_code, error_tag, started_at,
        finished_at
      ) VALUES (
        @id, @caseId, @productId, @syncType, @environment, @status,
        @resourceCount, @cacheStatus, @errorCode, @errorTag, @startedAt,
        @finishedAt
      )
    `).run(run)
    return structuredClone(run)
  }

  listSiscomexSyncRuns(criteria = {}) {
    const clauses = []
    const parameters = {}
    for (const [key, column] of Object.entries({ caseId: "case_id", productId: "product_id" })) {
      if (criteria[key] === undefined) continue
      clauses.push(`${column} IS @${key}`)
      parameters[key] = criteria[key]
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
    return this.database
      .prepare(`SELECT * FROM siscomex_sync_runs ${where} ORDER BY started_at DESC, rowid DESC`)
      .all(parameters)
      .map((row) => ({
        id: row.id,
        caseId: row.case_id,
        productId: row.product_id,
        syncType: row.sync_type,
        environment: row.environment,
        status: row.status,
        resourceCount: row.resource_count,
        cacheStatus: row.cache_status,
        errorCode: row.error_code,
        errorTag: row.error_tag,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      }))
  }

  close() {
    this.database.close()
  }

  #atomic(work) {
    if (this.database.inTransaction) return work()
    return this.database.transaction(work)()
  }

  #jsonRows(table, column, caseId) {
    return this.database
      .prepare(`SELECT ${column} FROM ${table} WHERE case_id = ? ORDER BY rowid`)
      .all(caseId)
      .map((item) => parse(item[column]))
  }

  #siscomexSnapshot(row) {
    if (!row) return null
    return {
      id: row.id,
      caseId: row.case_id,
      productId: row.product_id,
      subsystem: row.subsystem,
      environment: row.environment,
      resourceType: row.resource_type,
      resourceKey: row.resource_key,
      externalProductCode: row.external_product_code,
      externalVersion: row.external_version,
      foreignOperatorCode: row.foreign_operator_code,
      ncm: row.ncm,
      payload: parse(row.payload_json),
      payloadHash: row.payload_hash,
      fetchedAt: row.fetched_at,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      status: row.status,
      createdAt: row.created_at,
      cacheCheckedAt: row.cache_checked_at ?? null,
    }
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

  #persistRelated(operationalCase) {
    this.#persistDocuments(operationalCase)
    this.#persistEvidence(operationalCase)
    this.#persistFindings(operationalCase)
    this.#persistActions(operationalCase)
    this.#persistTimeline(operationalCase)
  }

  #persistDocuments(operationalCase) {
    const statement = this.database.prepare(`
      INSERT INTO documents (
        id, case_id, type, source_format, source_method, file_name,
        external_id, content_hash, storage_key, status, ingested_at,
        canonical_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        canonical_json=excluded.canonical_json, status=excluded.status,
        content_hash=excluded.content_hash, storage_key=excluded.storage_key
    `)
    for (const document of operationalCase.documents ?? []) {
      statement.run(
        document.id,
        operationalCase.id,
        document.type,
        document.source?.format ?? null,
        document.source?.method ?? null,
        document.source?.fileName ?? null,
        document.source?.externalId ?? null,
        document.metadata?.contentHash ?? null,
        document.metadata?.storageKey ?? null,
        document.metadata?.status ?? "INGESTED",
        document.metadata?.ingestedAt ?? null,
        json(document),
      )
    }
  }

  #persistEvidence(operationalCase) {
    const statement = this.database.prepare(`
      INSERT OR IGNORE INTO evidences (
        id, case_id, field, entity_type, entity_id, status, value_json,
        normalized_value_json, raw_value_json, source_json, confidence,
        extraction_json, extracted_at, supersedes_id, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const evidence of operationalCase.evidences ?? []) {
      const serialized = json(evidence)
      const result = statement.run(
        evidence.id,
        operationalCase.id,
        evidence.field,
        evidence.entityType,
        evidence.entityId ?? null,
        evidence.status,
        json(evidence.value),
        json(evidence.normalizedValue),
        json(evidence.rawValue),
        json(evidence.source),
        evidence.confidence,
        json(evidence.extraction),
        evidence.extractedAt,
        evidence.supersedes ?? null,
        serialized,
      )
      this.#assertImmutableInsert(
        result,
        "evidences",
        "evidence_json",
        evidence.id,
        serialized,
        "Evidence records are immutable",
      )
    }
  }

  #persistFindings(operationalCase) {
    const statement = this.database.prepare(`
      INSERT INTO findings (
        id, case_id, finding_key, type, field, severity, blocking, status,
        entity_type, entity_id, reason, created_at, resolved_at,
        dismissed_at, resolution_reason, version, finding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, resolved_at=excluded.resolved_at,
        dismissed_at=excluded.dismissed_at,
        resolution_reason=excluded.resolution_reason,
        version=excluded.version, finding_json=excluded.finding_json
    `)
    for (const finding of operationalCase.findings ?? []) {
      statement.run(
        finding.id,
        operationalCase.id,
        finding.key,
        finding.type,
        finding.field ?? null,
        finding.severity,
        finding.blocking ? 1 : 0,
        finding.status,
        finding.entityType ?? null,
        finding.entityId ?? null,
        finding.reason ?? null,
        finding.createdAt,
        finding.resolvedAt ?? null,
        finding.dismissedAt ?? null,
        finding.resolutionReason ?? null,
        finding.version ?? 1,
        json(finding),
      )
    }
  }

  #persistActions(operationalCase) {
    const statement = this.database.prepare(`
      INSERT INTO actions (
        id, case_id, finding_id, action_key, type, status, priority,
        assigned_role, created_at, updated_at, version, action_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, updated_at=excluded.updated_at,
        version=excluded.version, action_json=excluded.action_json
    `)
    for (const action of operationalCase.actions ?? []) {
      statement.run(
        action.id,
        operationalCase.id,
        action.findingId,
        action.key,
        action.type,
        action.status,
        action.priority,
        action.assignedRole ?? null,
        action.createdAt,
        action.updatedAt ?? null,
        action.version ?? 1,
        json(action),
      )
    }
  }

  #persistTimeline(operationalCase) {
    const statement = this.database.prepare(`
      INSERT OR IGNORE INTO timeline_events (
        event_id, case_id, type, timestamp, actor_json, metadata_json,
        case_version, event_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const event of operationalCase.timeline ?? []) {
      const serialized = json(event)
      const result = statement.run(
        event.eventId,
        operationalCase.id,
        event.type,
        event.timestamp,
        json(event.actor),
        json(event.metadata ?? event.details ?? {}),
        event.caseVersion,
        serialized,
      )
      this.#assertImmutableInsert(
        result,
        "timeline_events",
        "event_json",
        event.eventId,
        serialized,
        "Timeline events are immutable",
      )
    }
  }

  #assertImmutableInsert(result, table, column, id, serialized, message) {
    if (result.changes !== 0) return
    const existing = this.database
      .prepare(`SELECT ${column} FROM ${table} WHERE ${table === "timeline_events" ? "event_id" : "id"} = ?`)
      .get(id)
    if (existing[column] !== serialized) throw new ValidationError(message)
  }
}
