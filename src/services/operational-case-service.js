import { createHash, randomUUID } from "node:crypto"

import { createActionsFromFindings, mergeActions } from "../domain/actions/action-queue.js"
import { evaluateCatalog } from "../domain/catalog/evaluate-catalog.js"
import { createOperationalCase } from "../domain/cases/operational-case.js"
import { createDecision } from "../domain/decisions/create-decision.js"
import { createEvidence } from "../domain/evidence/evidence.js"
import { generateDocumentEvidences } from "../domain/evidence/generate-document-evidence.js"
import { createFindingsFromAnalysis, mergeFindings } from "../domain/findings/findings.js"
import { resolveProductIdentities } from "../domain/products/resolve-product-identities.js"
import { evaluateReadiness } from "../domain/readiness/evaluate-readiness.js"
import { reconcileDocuments } from "../domain/reconciliation/reconcile-documents.js"
import { CaseVersionConflictError, ValidationError } from "../domain/shared/errors.js"
import { createCanonicalDocument } from "../ingestion/canonical/canonical-document.js"
import { createDefaultIngestionService } from "../ingestion/ingestion-service.js"

const SYSTEM_ACTOR = Object.freeze({ type: "SYSTEM", id: "prisma", role: "SYSTEM" })

function normalizeActor(input, required = false) {
  if (!input && !required) return SYSTEM_ACTOR
  if (!input?.type || !input?.id) throw new ValidationError("Actor requires type and id")
  return { type: input.type, id: input.id, role: input.role ?? null }
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

const activeAction = (action) => ["OPEN", "IN_PROGRESS"].includes(action.status)

export class OperationalCaseService {
  constructor({ repository, idFactory = randomUUID, clock = () => new Date().toISOString(), ingestionService = null, documentStorage = null }) {
    this.repository = repository
    this.idFactory = idFactory
    this.clock = clock
    this.ingestionService = ingestionService ?? createDefaultIngestionService({ idFactory })
    this.documentStorage = documentStorage
  }

  createCase(input = {}) {
    return this.repository.transaction(() => {
      const timestamp = this.clock()
      const actor = normalizeActor(input.actor)
      const id = input.id ?? this.idFactory()
      const operationalCase = createOperationalCase({
        ...input,
        documents: (input.documents ?? []).map((document) =>
          this.ingestionService.ingest({ kind: "structured", document }),
        ),
        products: (input.products ?? []).map((product) => ({
          ...product,
          id: product.id ?? this.idFactory(),
        })),
      }, { id, timestamp, eventId: this.idFactory(), actor })
      for (const document of operationalCase.documents) {
        this.#appendEvent(operationalCase, "DOCUMENT_INGESTED", timestamp, {
          documentId: document.id,
          documentType: document.type,
        }, actor, 1)
      }
      return this.repository.create(operationalCase)
    })
  }

  getCase(id) {
    return this.repository.findById(id)
  }

  listCases(options) {
    return this.repository.list(options)
  }

  addDocument(caseId, document, options = {}) {
    return this.#storeDocument(
      caseId,
      this.ingestionService.ingest({ kind: "structured", document }),
      options,
    )
  }

  ingest(caseId, input, options = {}) {
    return this.#storeDocument(caseId, this.ingestionService.ingest(input), {
      ...options,
      idempotencyKey: options.idempotencyKey ?? input.idempotencyKey,
    })
  }

  uploadDocument(caseId, upload, options = {}) {
    if (!this.documentStorage) {
      throw new ValidationError("Binary document storage is not configured")
    }
    const before = this.getCase(caseId)
    const requestedIdempotencyKey = options.idempotencyKey ?? upload.idempotencyKey
    const keyedDocumentId = requestedIdempotencyKey
      ? before.idempotencyKeys[`document:${requestedIdempotencyKey}`]
      : null
    const requestedDuplicate = before.documents.find(
      (document) =>
        document.id === upload.documentId ||
        (upload.externalId && document.source?.externalId === upload.externalId) ||
        (keyedDocumentId && document.id === keyedDocumentId),
    )
    if (requestedDuplicate) return requestedDuplicate
    const contentHash = createHash("sha256").update(upload.buffer).digest("hex")
    const duplicate = before.documents.find(
      (document) => document.metadata?.contentHash === contentHash,
    )
    if (duplicate) return duplicate
    const storedBinary = this.documentStorage.store(upload)
    try {
      const common = {
        id: upload.documentId,
        fileName: storedBinary.safeFileName,
        documentType: upload.documentType,
      }
      let document
      if (storedBinary.extension === ".csv") {
        document = this.ingestionService.ingest({
          kind: "csv",
          ...common,
          content: upload.buffer.toString("utf8"),
        })
      } else if ([".xls", ".xlsx", ".xlsm"].includes(storedBinary.extension)) {
        document = this.ingestionService.ingest({
          kind: "spreadsheet",
          ...common,
          buffer: upload.buffer,
        })
      } else {
        document = createCanonicalDocument({
          id: upload.documentId ?? this.idFactory(),
          type: upload.documentType ?? "UNKNOWN",
          source: {
            format: "PDF",
            method: "BINARY_STORAGE",
            fileName: storedBinary.safeFileName,
            externalId: upload.externalId ?? null,
          },
          metadata: {},
        })
      }
      document.source.externalId = upload.externalId ?? null
      document.metadata = {
        ...document.metadata,
        contentHash: storedBinary.hash,
        storageKey: storedBinary.storageKey,
        mimeType: storedBinary.mimeType,
        byteSize: storedBinary.size,
        status: storedBinary.extension === ".pdf" ? "STORED" : "INGESTED",
        supersedesDocumentId: upload.supersedesDocumentId ?? null,
      }
      return this.#storeDocument(caseId, document, {
        ...options,
        idempotencyKey: requestedIdempotencyKey,
      })
    } catch (error) {
      this.documentStorage.remove(storedBinary.storageKey)
      throw error
    }
  }

  #storeDocument(caseId, storedDocument, options) {
    return this.repository.transaction(() => {
      const operationalCase = this.getCase(caseId)
      this.#assertExpectedVersion(operationalCase, options.expectedVersion)
      const duplicate = this.#duplicateDocument(
        operationalCase,
        storedDocument,
        options.idempotencyKey,
      )
      if (duplicate) return duplicate
      const timestamp = this.clock()
      const actor = normalizeActor(options.actor)
      storedDocument.metadata = { ...storedDocument.metadata, ingestedAt: timestamp }
      operationalCase.documents.push(storedDocument)
      if (options.idempotencyKey) {
        operationalCase.idempotencyKeys[`document:${options.idempotencyKey}`] = storedDocument.id
      }
      this.#appendEvent(operationalCase, "DOCUMENT_INGESTED", timestamp, {
        documentId: storedDocument.id,
        documentType: storedDocument.type,
        format: storedDocument.source?.format ?? null,
        contentHash: storedDocument.metadata?.contentHash ?? null,
      }, actor)
      operationalCase.updatedAt = timestamp
      this.#save(operationalCase, timestamp, actor)
      return structuredClone(storedDocument)
    })
  }

  #duplicateDocument(operationalCase, document, idempotencyKey) {
    const keyedId = idempotencyKey
      ? operationalCase.idempotencyKeys[`document:${idempotencyKey}`]
      : null
    if (keyedId) return operationalCase.documents.find((item) => item.id === keyedId)
    if (document.source?.externalId) {
      return operationalCase.documents.find(
        (item) => item.source?.externalId === document.source.externalId,
      )
    }
    return operationalCase.documents.find((item) => item.id === document.id)
  }

  analyze(caseId, options = {}) {
    return this.repository.transaction(() => {
      const operationalCase = this.getCase(caseId)
      this.#assertExpectedVersion(operationalCase, options.expectedVersion)
      const analysisFingerprint = hash({
        documents: operationalCase.documents,
        resolvedFields: operationalCase.resolvedFields,
      })
      if (
        operationalCase.idempotencyKeys.analysisFingerprint === analysisFingerprint &&
        operationalCase.readiness
      ) return this.buildResult(operationalCase)

      const timestamp = this.clock()
      const actor = normalizeActor(options.actor)
      const previousReadiness = operationalCase.readiness?.status ?? null
      const previousDecision = operationalCase.decision?.type ?? null
      const previousActionIds = new Set(operationalCase.actions.map((item) => item.id))
      const previousFindingStates = new Map(
        operationalCase.findings.map((item) => [item.id, item.status]),
      )
      const immutableEvidenceIds = new Set(
        operationalCase.evidences.map((evidence) => evidence.id),
      )
      const evidencedDocumentIds = new Set(
        operationalCase.evidences.map((evidence) => evidence.source?.documentId).filter(Boolean),
      )
      const documentsWithoutEvidence = operationalCase.documents.filter(
        (document) => !evidencedDocumentIds.has(document.id),
      )
      const newDocumentEvidences = generateDocumentEvidences(
        documentsWithoutEvidence,
        { idFactory: this.idFactory, timestamp },
      )
      this.#linkSupersededEvidence(operationalCase, newDocumentEvidences, timestamp, actor)
      const reconciliation = reconcileDocuments(operationalCase.documents, {
        idFactory: this.idFactory,
        timestamp,
        resolvedFields: operationalCase.resolvedFields,
        evidences: [
          ...operationalCase.evidences.map((item) => structuredClone(item)),
          ...newDocumentEvidences,
        ],
        immutableEvidenceIds,
      })
      const reconciledNew = reconciliation.evidences.filter(
        (item) => !immutableEvidenceIds.has(item.id),
      )
      operationalCase.evidences.push(...reconciledNew)
      const resolvedValues = Object.fromEntries(
        Object.entries(operationalCase.resolvedFields).map(([field, item]) => [field, item.value]),
      )
      operationalCase.catalogGovernance = evaluateCatalog(
        operationalCase.products.map((product) => ({ ...product, ...resolvedValues })),
        reconciliation,
      )
      const evidenceIdsByItem = new Map()
      for (const evidence of operationalCase.evidences) {
        if (evidence.entityType !== "documentItem" || !evidence.entityId) continue
        if (!evidenceIdsByItem.has(evidence.entityId)) evidenceIdsByItem.set(evidence.entityId, [])
        evidenceIdsByItem.get(evidence.entityId).push(evidence.id)
      }
      const identity = resolveProductIdentities(operationalCase.documents, {
        idFactory: this.idFactory,
        timestamp,
        evidenceIdsByItem,
      })
      operationalCase.productIdentities = identity.productIdentities
      const proposedFindings = [
        ...createFindingsFromAnalysis(
          { ...reconciliation, catalogGovernance: operationalCase.catalogGovernance },
          { idFactory: this.idFactory, timestamp },
        ),
        ...identity.findings,
      ]
      operationalCase.findings = mergeFindings(
        operationalCase.findings,
        proposedFindings,
        timestamp,
      )
      operationalCase.actions = mergeActions(
        operationalCase.actions,
        createActionsFromFindings(operationalCase.findings, {
          idFactory: this.idFactory,
          timestamp,
        }),
        timestamp,
      )
      operationalCase.divergences = reconciliation.divergences
      operationalCase.missingFields = reconciliation.missingFields
      this.#refreshRisks(operationalCase)
      for (const evidence of reconciledNew) {
        this.#appendEvent(operationalCase, "EVIDENCE_CREATED", timestamp, {
          evidenceId: evidence.id,
          field: evidence.field,
          status: evidence.status,
        }, actor)
      }
      this.#recordFindingAndActionChanges(
        operationalCase,
        previousFindingStates,
        previousActionIds,
        timestamp,
        actor,
      )
      this.#updateReadinessAndDecision(
        operationalCase,
        timestamp,
        previousReadiness,
        previousDecision,
        actor,
      )
      operationalCase.lastAnalyzedAt = timestamp
      operationalCase.idempotencyKeys.analysisFingerprint = analysisFingerprint
      operationalCase.updatedAt = timestamp
      this.#appendEvent(operationalCase, "ANALYSIS_COMPLETED", timestamp, {
        readiness: operationalCase.readiness.status,
        decision: operationalCase.decision.type,
      }, actor)
      return this.buildResult(this.#save(operationalCase, timestamp, actor))
    })
  }

  startAction(caseId, actionId, input = {}) {
    return this.#transitionAction(caseId, actionId, "IN_PROGRESS", input)
  }

  cancelAction(caseId, actionId, input = {}) {
    if (!input.reason) throw new ValidationError("Cancelling an Action requires a reason")
    return this.#transitionAction(caseId, actionId, "CANCELLED", input)
  }

  reopenAction(caseId, actionId, input = {}) {
    if (!input.reason) throw new ValidationError("Reopening an Action requires a reason")
    return this.#transitionAction(caseId, actionId, "OPEN", input)
  }

  #transitionAction(caseId, actionId, target, input) {
    return this.repository.transaction(() => {
      const operationalCase = this.getCase(caseId)
      this.#assertExpectedVersion(operationalCase, input.expectedVersion)
      const action = operationalCase.actions.find((item) => item.id === actionId)
      if (!action) throw new ValidationError(`Action not found: ${actionId}`)
      const allowed = {
        OPEN: ["IN_PROGRESS", "CANCELLED"],
        IN_PROGRESS: ["CANCELLED"],
        RESOLVED: ["OPEN"],
        CANCELLED: ["OPEN"],
      }
      if (!allowed[action.status]?.includes(target)) {
        throw new ValidationError(`Invalid Action transition: ${action.status} -> ${target}`)
      }
      if (
        target === "OPEN" &&
        operationalCase.actions.some(
          (item) => item.id !== action.id && item.findingId === action.findingId && activeAction(item),
        )
      ) throw new ValidationError("Finding already has an active Action")
      const timestamp = this.clock()
      const actor = normalizeActor(input.actor)
      const previous = action.status
      const reason = input.reason ?? (target === "IN_PROGRESS" ? "WORK_STARTED" : target)
      action.status = target
      action.updatedAt = timestamp
      action.version = (action.version ?? 1) + 1
      action.history = [...(action.history ?? []), {
        from: previous,
        to: target,
        reason,
        actor,
        timestamp,
        evidenceIds: [...(input.evidenceIds ?? [])],
      }]
      if (target === "CANCELLED") {
        action.cancelledAt = timestamp
        action.cancellationReason = input.reason
      }
      const eventType = target === "IN_PROGRESS" ? "ACTION_STARTED" : `ACTION_${target}`
      this.#appendEvent(operationalCase, eventType, timestamp, {
        actionId,
        findingId: action.findingId,
        from: previous,
        to: target,
        reason,
        evidenceIds: input.evidenceIds ?? [],
      }, actor)
      const created = target === "CANCELLED"
        ? this.#ensureActiveActions(operationalCase, timestamp)
        : []
      for (const replacement of created) {
        this.#appendEvent(operationalCase, "ACTION_CREATED", timestamp, {
          actionId: replacement.id,
          findingId: replacement.findingId,
          predecessorActionId: replacement.predecessorActionId,
        }, actor)
      }
      operationalCase.updatedAt = timestamp
      return this.buildResult(this.#save(operationalCase, timestamp, actor))
    })
  }

  resolveAction(caseId, actionId, resolution = {}) {
    const hasValue = resolution.value !== undefined && resolution.value !== null && resolution.value !== ""
    const hasSource = Boolean(resolution.source?.type)
    if (hasValue !== hasSource) {
      throw new ValidationError("Resolution evidence requires both value and source.type")
    }
    return this.repository.transaction(() => {
      const operationalCase = this.getCase(caseId)
      this.#assertExpectedVersion(operationalCase, resolution.expectedVersion)
      const action = operationalCase.actions.find((item) => item.id === actionId)
      if (!action) throw new ValidationError(`Action not found: ${actionId}`)
      if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(action.status)) {
        throw new ValidationError(`Action cannot be resolved from ${action.status}`)
      }
      if (action.status === "RESOLVED" && !hasValue) return this.buildResult(operationalCase)
      const timestamp = this.clock()
      const actor = normalizeActor(
        resolution.actor ?? (resolution.resolvedBy ? { type: "USER", id: resolution.resolvedBy } : undefined),
      )
      const previousReadiness = operationalCase.readiness?.status ?? null
      const previousDecision = operationalCase.decision?.type ?? null
      const finding = operationalCase.findings.find((item) => item.id === action.findingId)
      const previous = action.status
      const transitionReason =
        resolution.reason ??
        resolution.notes ??
        (hasValue ? "CONFIRMED_EVIDENCE" : "ADMINISTRATIVE_COMPLETION")
      let evidence = null
      if (hasValue) {
        evidence = createEvidence({
          field: action.field ?? action.cause,
          value: resolution.value,
          normalizedValue: resolution.value,
          rawValue: resolution.rawValue ?? resolution.value,
          entityType: action.entityType ?? "case",
          entityId: action.entityId ?? null,
          status: "confirmed",
          source: resolution.source,
          confidence: resolution.confidence ?? "high",
          extraction: resolution.extraction ?? { method: "MANUAL_RESOLUTION", confidence: null },
        }, { id: this.idFactory(), timestamp })
        operationalCase.evidences.push(evidence)
        if (action.type === "REVIEW_CATALOG" && action.entityId && action.field) {
          const product = operationalCase.products.find((item) => item.id === action.entityId)
          if (product) product[action.field] = resolution.value
        } else if (action.field) {
          operationalCase.resolvedFields[action.field] = { value: resolution.value, evidence }
          operationalCase.divergences = operationalCase.divergences.map((item) =>
            item.field === action.field ? { ...item, status: "resolved" } : item,
          )
          operationalCase.missingFields = operationalCase.missingFields.filter(
            (item) => item.field !== action.field,
          )
        }
        if (finding?.status === "OPEN") {
          finding.status = "RESOLVED"
          finding.resolvedAt = timestamp
          finding.resolutionReason = transitionReason
          finding.resolutionEvidenceId = evidence.id
          finding.version = (finding.version ?? 1) + 1
        }
        this.#appendEvent(operationalCase, "EVIDENCE_CREATED", timestamp, {
          evidenceId: evidence.id,
          field: evidence.field,
          status: evidence.status,
        }, actor)
        if (finding) {
          this.#appendEvent(operationalCase, "FINDING_RESOLVED", timestamp, {
            findingId: finding.id,
            evidenceIds: [evidence.id],
            reason: finding.resolutionReason,
          }, actor)
          this.#appendEvent(operationalCase, "FINDING_STATUS_CHANGED", timestamp, {
            findingId: finding.id,
            from: "OPEN",
            to: "RESOLVED",
            evidenceIds: [evidence.id],
          }, actor)
        }
        const resolvedValues = Object.fromEntries(
          Object.entries(operationalCase.resolvedFields).map(([field, item]) => [
            field,
            item.value,
          ]),
        )
        operationalCase.catalogGovernance = evaluateCatalog(
          operationalCase.products.map((product) => ({
            ...product,
            ...resolvedValues,
          })),
          { evidences: operationalCase.evidences },
        )
        delete operationalCase.idempotencyKeys.analysisFingerprint
      }
      action.status = "RESOLVED"
      action.updatedAt = timestamp
      action.version = (action.version ?? 1) + 1
      action.resolutionEvidenceId = evidence?.id ?? action.resolutionEvidenceId ?? null
      action.resolution = {
        value: hasValue ? resolution.value : null,
        notes: resolution.notes ?? null,
        resolvedBy: actor.id,
        resolvedAt: timestamp,
      }
      action.history = [...(action.history ?? []), {
        from: previous,
        to: "RESOLVED",
        reason: transitionReason,
        actor,
        timestamp,
        evidenceIds: evidence ? [evidence.id] : [],
      }]
      this.#appendEvent(operationalCase, "ACTION_RESOLVED", timestamp, {
        actionId,
        findingId: action.findingId,
        from: previous,
        to: "RESOLVED",
        reason: transitionReason,
        evidenceIds: evidence ? [evidence.id] : [],
      }, actor)
      for (const replacement of this.#ensureActiveActions(operationalCase, timestamp)) {
        this.#appendEvent(operationalCase, "ACTION_CREATED", timestamp, {
          actionId: replacement.id,
          findingId: replacement.findingId,
          predecessorActionId: replacement.predecessorActionId,
        }, actor)
      }
      this.#refreshRisks(operationalCase)
      this.#updateReadinessAndDecision(
        operationalCase,
        timestamp,
        previousReadiness,
        previousDecision,
        actor,
      )
      operationalCase.updatedAt = timestamp
      return this.buildResult(this.#save(operationalCase, timestamp, actor))
    })
  }

  dismissFinding(caseId, findingId, input = {}) {
    if (!input.reason) throw new ValidationError("Dismissing a Finding requires a reason")
    const actor = normalizeActor(input.actor, true)
    return this.repository.transaction(() => {
      const operationalCase = this.getCase(caseId)
      this.#assertExpectedVersion(operationalCase, input.expectedVersion)
      const finding = operationalCase.findings.find((item) => item.id === findingId)
      if (!finding) throw new ValidationError(`Finding not found: ${findingId}`)
      if (finding.status !== "OPEN") {
        throw new ValidationError(`Finding cannot be dismissed from ${finding.status}`)
      }
      const timestamp = this.clock()
      const previousReadiness = operationalCase.readiness?.status ?? null
      const previousDecision = operationalCase.decision?.type ?? null
      finding.status = "DISMISSED"
      finding.dismissedAt = timestamp
      finding.resolutionReason = input.reason
      finding.dismissedBy = actor
      finding.version = (finding.version ?? 1) + 1
      for (const action of operationalCase.actions.filter(
        (item) => item.findingId === finding.id && activeAction(item),
      )) {
        action.status = "CANCELLED"
        action.cancelledAt = timestamp
        action.cancellationReason = "FINDING_DISMISSED"
        action.updatedAt = timestamp
        action.version = (action.version ?? 1) + 1
        this.#appendEvent(operationalCase, "ACTION_CANCELLED", timestamp, {
          actionId: action.id,
          findingId: finding.id,
          reason: "FINDING_DISMISSED",
        }, actor)
      }
      this.#appendEvent(operationalCase, "FINDING_DISMISSED", timestamp, {
        findingId,
        reason: input.reason,
        blocking: finding.blocking,
      }, actor)
      this.#refreshRisks(operationalCase)
      this.#updateReadinessAndDecision(
        operationalCase,
        timestamp,
        previousReadiness,
        previousDecision,
        actor,
      )
      operationalCase.updatedAt = timestamp
      return this.buildResult(this.#save(operationalCase, timestamp, actor))
    })
  }

  validateCatalog(input = {}) {
    return evaluateCatalog(input.products ?? [], {
      evidences: input.evidences ?? [],
      divergences: input.divergences ?? [],
    })
  }

  buildResult(operationalCase) {
    return {
      caseId: operationalCase.id,
      version: operationalCase.version,
      readiness: operationalCase.readiness,
      decision: operationalCase.decision,
      actions: operationalCase.actions,
      findings: operationalCase.findings,
      evidences: operationalCase.evidences,
      divergences: operationalCase.divergences,
      missingFields: operationalCase.missingFields,
      risks: operationalCase.risks,
      catalogGovernance: operationalCase.catalogGovernance,
      productIdentities: operationalCase.productIdentities,
      quantitativePrediction: operationalCase.quantitativePrediction,
      timeline: operationalCase.timeline,
    }
  }

  #assertExpectedVersion(operationalCase, expectedVersion) {
    if (expectedVersion === undefined || expectedVersion === null) return
    if (operationalCase.version !== expectedVersion) {
      throw new CaseVersionConflictError(
        operationalCase.id,
        expectedVersion,
        operationalCase.version,
      )
    }
  }

  #appendEvent(operationalCase, type, timestamp, metadata = {}, actor = SYSTEM_ACTOR, caseVersion = operationalCase.version + 1) {
    operationalCase.timeline.push({
      eventId: this.idFactory(),
      caseId: operationalCase.id,
      type,
      timestamp,
      actor,
      metadata,
      details: metadata,
      caseVersion,
    })
  }

  #save(operationalCase, timestamp, actor) {
    const expectedVersion = operationalCase.version
    this.#appendEvent(operationalCase, "CASE_VERSION_CHANGED", timestamp, {
      from: expectedVersion,
      to: expectedVersion + 1,
    }, actor, expectedVersion + 1)
    return this.repository.save(operationalCase, expectedVersion)
  }

  #linkSupersededEvidence(operationalCase, newEvidence, timestamp, actor) {
    const documents = new Map(operationalCase.documents.map((item) => [item.id, item]))
    for (const evidence of newEvidence) {
      const supersedesDocumentId = documents.get(evidence.source?.documentId)
        ?.metadata?.supersedesDocumentId
      if (!supersedesDocumentId) continue
      const predecessor = operationalCase.evidences.findLast(
        (item) =>
          item.source?.documentId === supersedesDocumentId &&
          item.field === evidence.field &&
          item.entityType === evidence.entityType,
      )
      if (!predecessor) continue
      evidence.supersedes = predecessor.id
      this.#appendEvent(operationalCase, "EVIDENCE_SUPERSEDED", timestamp, {
        evidenceId: predecessor.id,
        supersededByEvidenceId: evidence.id,
      }, actor)
    }
  }

  #ensureActiveActions(operationalCase, timestamp) {
    const previous = new Set(operationalCase.actions.map((item) => item.id))
    operationalCase.actions = mergeActions(
      operationalCase.actions,
      createActionsFromFindings(operationalCase.findings, {
        idFactory: this.idFactory,
        timestamp,
      }),
      timestamp,
    )
    return operationalCase.actions.filter((item) => !previous.has(item.id))
  }

  #recordFindingAndActionChanges(operationalCase, previousFindingStates, previousActionIds, timestamp, actor) {
    for (const finding of operationalCase.findings) {
      const previous = previousFindingStates.get(finding.id)
      if (!previous) {
        this.#appendEvent(operationalCase, "FINDING_CREATED", timestamp, {
          findingId: finding.id,
          type: finding.type,
          field: finding.field,
          blocking: finding.blocking,
        }, actor)
      } else if (previous !== finding.status) {
        this.#appendEvent(
          operationalCase,
          finding.status === "RESOLVED" ? "FINDING_RESOLVED" : "FINDING_STATUS_CHANGED",
          timestamp,
          { findingId: finding.id, from: previous, to: finding.status },
          actor,
        )
      }
    }
    for (const action of operationalCase.actions) {
      if (!previousActionIds.has(action.id)) {
        this.#appendEvent(operationalCase, "ACTION_CREATED", timestamp, {
          actionId: action.id,
          findingId: action.findingId,
          cause: action.cause,
          blocking: action.blocking,
        }, actor)
      }
    }
  }

  #refreshRisks(operationalCase) {
    operationalCase.risks = operationalCase.findings
      .filter((finding) => finding.status === "OPEN")
      .map((finding) => ({
        code: finding.reason,
        severity: finding.severity,
        blocking: finding.blocking,
      }))
  }

  #updateReadinessAndDecision(operationalCase, timestamp, previousReadiness, previousDecision, actor) {
    operationalCase.readiness = evaluateReadiness(
      operationalCase.findings,
      operationalCase.actions,
    )
    operationalCase.status = operationalCase.readiness.status
    operationalCase.decision = createDecision(operationalCase.readiness, {
      id: this.idFactory(),
      timestamp,
    })
    if (previousReadiness !== operationalCase.readiness.status) {
      this.#appendEvent(operationalCase, "READINESS_CHANGED", timestamp, {
        from: previousReadiness,
        to: operationalCase.readiness.status,
        reason: operationalCase.readiness.reasons,
      }, actor)
    }
    if (previousDecision !== operationalCase.decision.type) {
      operationalCase.decisions.push(operationalCase.decision)
      this.#appendEvent(operationalCase, "DECISION_CHANGED", timestamp, {
        from: previousDecision,
        to: operationalCase.decision.type,
      }, actor)
    }
  }
}
