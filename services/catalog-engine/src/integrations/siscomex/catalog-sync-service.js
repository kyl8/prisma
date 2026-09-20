import { randomUUID } from "node:crypto"

import { consolidateCatalog } from "../../domain/catalog/consolidate-catalog.js"
import { NotFoundError, ValidationError } from "../../domain/shared/errors.js"
import { compareCatalogWithSiscomex } from "./compare-catalog.js"
import {
  mapOfficialAttributeRequirements,
  mapOfficialCatalogProduct,
  mapOfficialForeignOperator,
  mapOfficialNcm,
} from "./mappers.js"
import {
  officialAttributeRequirementEvidence,
  officialOperatorEvidence,
  officialProductEvidence,
} from "./official-evidence.js"
import {
  createSiscomexSnapshot,
  snapshotFreshness,
} from "./snapshot.js"
import { ncmCode } from "./validation.js"

function resourceKey(parts) {
  return parts.filter((part) => part !== null && part !== undefined).join(":")
}

export class SiscomexCatalogSyncService {
  constructor({
    config,
    repository,
    sessionManager,
    catpClient,
    cadaClient,
    classifClient,
    idFactory = randomUUID,
    clock = () => new Date().toISOString(),
    now = Date.now,
  }) {
    this.config = config
    this.repository = repository
    this.sessionManager = sessionManager
    this.catpClient = catpClient
    this.cadaClient = cadaClient
    this.classifClient = classifClient
    this.idFactory = idFactory
    this.clock = clock
    this.now = now
  }

  status() {
    const latestRun = this.repository.listSiscomexSyncRuns()[0] ?? null
    return {
      enabled: this.config.enabled,
      configured: this.config.configured,
      environment: this.config.environment,
      status: !this.config.enabled
        ? "DISABLED"
        : !this.config.configured
          ? "NOT_CONFIGURED"
          : latestRun?.status === "RATE_LIMITED"
            ? "RATE_LIMITED"
            : ["UNAVAILABLE", "STALE"].includes(latestRun?.status)
              ? "UNAVAILABLE"
              : "CONFIGURED",
      lastSync: latestRun?.finishedAt ?? null,
      cacheStatus: latestRun?.cacheStatus ?? "UNAVAILABLE",
      cacheTtlSeconds: this.config.cacheTtlSeconds,
      readOnly: true,
    }
  }

  async testConnection() {
    await this.sessionManager.getSession()
    return {
      status: "CONNECTED",
      environment: this.config.environment,
      roleType: this.config.roleType,
      readOnly: true,
    }
  }

  async syncProduct(operationalCase, input = {}) {
    const startedAt = this.clock()
    const productId = input.productId ?? operationalCase.products?.[0]?.id
    const localProduct = operationalCase.products.find((item) => item.id === productId)
    if (!localProduct) throw new NotFoundError("Product", productId)
    const responsibleRootId =
      input.responsibleRootId ??
      localProduct.responsibleRootId ??
      this.config.responsibleRootId
    const productCode =
      input.productCode ?? localProduct.siscomexProductCode ?? localProduct.productCode
    const version = String(
      input.version ?? localProduct.siscomexVersion ?? localProduct.officialVersion ?? "",
    )
    if (!responsibleRootId || !productCode || !version) {
      throw new ValidationError(
        "Siscomex sync requires productId, responsibleRootId, productCode and version",
      )
    }

    const cacheStates = []
    const snapshots = []
    try {
      const productResource = await this.#loadResource({
        caseId: operationalCase.id,
        productId,
        subsystem: "CATP",
        resourceType: "PRODUCT",
        resourceKey: resourceKey([responsibleRootId, productCode, version]),
        externalProductCode: String(productCode),
        externalVersion: version,
        force: input.force === true,
        fetcher: () => this.catpClient.getProduct({
          responsibleRootId,
          productCode,
          version,
        }),
      })
      cacheStates.push(productResource.cacheStatus)
      snapshots.push(productResource.snapshot)
      const officialProduct = mapOfficialCatalogProduct(
        productResource.snapshot.payload,
        productResource.snapshot,
      )

      let officialOperator = null
      if (input.foreignOperator?.code) {
        const operatorVersion = String(input.foreignOperator.version ?? "1")
        const operatorResource = await this.#loadResource({
          caseId: operationalCase.id,
          productId,
          subsystem: "CATP",
          resourceType: "FOREIGN_OPERATOR",
          resourceKey: resourceKey([
            responsibleRootId,
            input.foreignOperator.country,
            input.foreignOperator.code,
            operatorVersion,
          ]),
          foreignOperatorCode: input.foreignOperator.code,
          force: input.force === true,
          fetcher: () => this.catpClient.getForeignOperator({
            responsibleRootId,
            country: input.foreignOperator.country,
            operatorCode: input.foreignOperator.code,
            version: operatorVersion,
          }),
        })
        cacheStates.push(operatorResource.cacheStatus)
        snapshots.push(operatorResource.snapshot)
        officialOperator = mapOfficialForeignOperator(
          operatorResource.snapshot.payload,
          operatorResource.snapshot,
        )
      }

      const reportedNcm = officialProduct.ncm ?? localProduct.reportedNcm ?? localProduct.ncm
      let requirements = []
      if (reportedNcm) {
        const normalizedNcm = ncmCode(reportedNcm)
        const cadaResource = await this.#loadResource({
          caseId: operationalCase.id,
          productId,
          subsystem: "CADA",
          resourceType: "ATTRIBUTE_REQUIREMENTS",
          resourceKey: normalizedNcm,
          ncm: normalizedNcm,
          force: input.force === true,
          fetcher: () => this.cadaClient.getAttributesForNcm(normalizedNcm, {
            operationMode: input.operationMode,
          }),
        })
        cacheStates.push(cadaResource.cacheStatus)
        snapshots.push(cadaResource.snapshot)
        requirements = mapOfficialAttributeRequirements(
          cadaResource.snapshot.payload,
          normalizedNcm,
        )
      }

      const timestamp = this.clock()
      const productEvidence = officialProductEvidence(
        officialProduct,
        productResource.snapshot,
        { productId, idFactory: this.idFactory, timestamp },
      )
      const operatorSnapshot = snapshots.find(
        (snapshot) => snapshot.resourceType === "FOREIGN_OPERATOR",
      )
      const operatorEvidence = officialOperator
        ? officialOperatorEvidence(officialOperator, operatorSnapshot, {
          productId,
          idFactory: this.idFactory,
          timestamp,
        })
        : []
      const cadaSnapshot = snapshots.find(
        (snapshot) => snapshot.resourceType === "ATTRIBUTE_REQUIREMENTS",
      )
      const requirementEvidence = cadaSnapshot
        ? officialAttributeRequirementEvidence(requirements, cadaSnapshot, {
          productId,
          idFactory: this.idFactory,
          timestamp,
        })
        : []
      const evidences = [
        ...productEvidence,
        ...operatorEvidence,
        ...requirementEvidence,
      ]
      const record = consolidateCatalog(operationalCase).records.find(
        (item) => item.productId === productId || item.sourceProductIds.includes(productId),
      )
      if (!record) throw new NotFoundError("CatalogRecord", productId)
      const diff = compareCatalogWithSiscomex({
        record,
        product: officialProduct,
        operator: officialOperator,
        requirements,
        evidences,
        localProduct,
        idFactory: this.idFactory,
        timestamp,
      })
      const cacheStatus = cacheStates.includes("STALE") ? "STALE" : "FRESH"
      this.#saveRun({
        caseId: operationalCase.id,
        productId,
        status: cacheStatus === "STALE" ? "STALE" : "SUCCESS",
        cacheStatus,
        resourceCount: snapshots.length,
        startedAt,
      })
      return {
        productId,
        environment: this.config.environment,
        cacheStatus,
        fetchedAt: timestamp,
        officialProduct,
        officialOperator,
        requirements,
        snapshots,
        evidences,
        findings: diff.findings,
        recommendations: diff.recommendations,
        diff,
      }
    } catch (error) {
      this.#saveRun({
        caseId: operationalCase.id,
        productId,
        status: error.rateLimited ? "RATE_LIMITED" : "UNAVAILABLE",
        cacheStatus: snapshots.length ? "STALE" : "UNAVAILABLE",
        resourceCount: snapshots.length,
        errorCode: error.code ?? "SISCOMEX_SYNC_FAILED",
        errorTag: error.tag ?? null,
        startedAt,
      })
      throw error
    }
  }

  listCaseSnapshots(caseId) {
    return this.repository.listSiscomexSnapshots({ caseId }).map((snapshot) => ({
      ...snapshot,
      cacheStatus: snapshotFreshness(
        snapshot,
        this.config.cacheTtlSeconds,
        this.now(),
      ),
    }))
  }

  async getAttributes(ncm, options = {}) {
    const normalizedNcm = ncmCode(ncm)
    const resource = await this.#loadResource({
      subsystem: "CADA",
      resourceType: "ATTRIBUTE_REQUIREMENTS",
      resourceKey: normalizedNcm,
      ncm: normalizedNcm,
      force: options.force === true,
      fetcher: () => this.cadaClient.getAttributesForNcm(normalizedNcm, options),
    })
    return {
      ncm: normalizedNcm,
      cacheStatus: resource.cacheStatus,
      fetchedAt: resource.snapshot.fetchedAt,
      requirements: mapOfficialAttributeRequirements(
        resource.snapshot.payload,
        normalizedNcm,
      ),
    }
  }

  async getNcm(ncm, options = {}) {
    const normalizedNcm = ncmCode(ncm)
    const resource = await this.#loadResource({
      subsystem: "CLASSIF",
      resourceType: "NOMENCLATURE",
      resourceKey: "complete",
      force: options.force === true,
      fetcher: () => this.classifClient.downloadNomenclature(),
    })
    const officialNcm = mapOfficialNcm(
      resource.snapshot.payload,
      normalizedNcm,
      resource.snapshot,
    )
    return {
      ncm: normalizedNcm,
      exists: Boolean(officialNcm),
      cacheStatus: resource.cacheStatus,
      fetchedAt: resource.snapshot.fetchedAt,
      officialNcm,
      classificationAssigned: false,
    }
  }

  async #loadResource({
    caseId = null,
    productId = null,
    subsystem,
    resourceType,
    resourceKey: selectedResourceKey,
    force,
    fetcher,
    ...metadata
  }) {
    const criteria = {
      caseId,
      productId,
      subsystem,
      environment: this.config.environment,
      resourceType,
      resourceKey: selectedResourceKey,
    }
    const latest = this.repository.findLatestSiscomexSnapshot(criteria)
    const freshness = snapshotFreshness(
      latest,
      this.config.cacheTtlSeconds,
      this.now(),
    )
    if (!force && freshness === "FRESH") {
      return { snapshot: latest, cacheStatus: "FRESH", fromCache: true }
    }
    try {
      const response = await fetcher()
      const timestamp = this.clock()
      const snapshot = this.repository.saveSiscomexSnapshot(
        createSiscomexSnapshot({
          caseId,
          productId,
          subsystem,
          environment: this.config.environment,
          resourceType,
          resourceKey: selectedResourceKey,
          payload: response.data,
          fetchedAt: timestamp,
          ...metadata,
        }, { id: this.idFactory(), timestamp }),
      )
      return { snapshot, cacheStatus: "FRESH", fromCache: false }
    } catch (error) {
      if (latest) {
        return {
          snapshot: latest,
          cacheStatus: "STALE",
          fromCache: true,
          unavailableReason: error.code ?? "SISCOMEX_UNAVAILABLE",
        }
      }
      throw error
    }
  }

  #saveRun({
    caseId,
    productId,
    status,
    resourceCount,
    cacheStatus,
    errorCode = null,
    errorTag = null,
    startedAt,
  }) {
    const finishedAt = this.clock()
    this.repository.saveSiscomexSyncRun({
      id: this.idFactory(),
      caseId: caseId ?? null,
      productId: productId ?? null,
      syncType: "MANUAL_PRODUCT",
      environment: this.config.environment,
      status,
      resourceCount,
      cacheStatus,
      errorCode,
      errorTag,
      startedAt,
      finishedAt,
    })
  }
}
