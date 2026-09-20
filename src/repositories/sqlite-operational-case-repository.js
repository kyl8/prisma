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
            product_identities_json, idempotency_keys_json, created_at,
            updated_at, last_analyzed_at
          ) VALUES (
            @id, @status, @version, @metadata, @parties, @shipment,
            @products, @operationalMetrics, @readiness, @decision,
            @catalogGovernance, @divergences, @missingFields, @risks,
            @decisions, @resolvedFields, @quantitativePrediction,
            @productIdentities, @idempotencyKeys, @createdAt, @updatedAt,
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
