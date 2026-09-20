import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { recordActivity } from "@/modules/activity/activity.service";
import { createNotification } from "@/modules/notification/notification.service";
import { cachedResource, freshness } from "./siscomex.cache";
import { digits, getSiscomexClient, redactPayload, SiscomexClient, SiscomexError } from "./siscomex.client";
import { canonicalJson, compareProduct, mapNcm, mapOperator, mapProduct, mapRequirements, object, payloadItems, type AttributeRequirement, type LocalProduct, type OfficialOperator, type OfficialProduct } from "./siscomex.mapping";

export type SyncInput = { productCode: string; version: string; force?: boolean; operationMode: "IMPORTACAO" | "EXPORTACAO"; foreignOperator?: { code: string; country: string; version: string } };
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(redactPayload(value))) as Prisma.InputJsonValue;
type StoredResult = { officialProduct: OfficialProduct; officialOperator: OfficialOperator | null; requirements: AttributeRequirement[]; snapshots: { id: string; resourceType: string; payloadHash: string; fetchedAt: string; cacheStatus: string }[]; cacheStatus: string; diff: ReturnType<typeof compareProduct> };

export class SiscomexService {
  constructor(private db: PrismaClient = prisma, private client: SiscomexClient = getSiscomexClient()) {}

  async broker(userId: string) {
    const broker = await this.db.customsbroker.findUnique({ where: { userId }, select: { id: true, companyAccesses: { select: { companyId: true } } } });
    if (!broker) throw new SiscomexError("FORBIDDEN", "Somente despachantes podem consultar esta integração.", 403);
    return broker;
  }

  async company(userId: string, companyId: string) {
    const broker = await this.broker(userId);
    if (!broker.companyAccesses.some((entry) => entry.companyId === companyId)) throw new SiscomexError("FORBIDDEN", "Você não possui acesso a esta empresa.", 403);
    const company = await this.db.importer.findUnique({ where: { id: companyId }, select: { id: true, user: { select: { cnpj: true, enterprise: true } } } });
    if (!company) throw new SiscomexError("NOT_FOUND", "Empresa não encontrada.", 404);
    return { ...company, root: digits(company.user.cnpj, [14], "CNPJ da empresa").slice(0, 8) };
  }

  private async product(companyId: string, productId: string): Promise<LocalProduct> {
    const product = await this.db.product.findFirst({ where: { id: productId, importerId: companyId }, include: { fields: true, records: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { fieldResp: true } } } });
    if (!product) throw new SiscomexError("NOT_FOUND", "Produto não encontrado neste catálogo.", 404);
    const values = new Map<string, string>();
    for (const record of product.records) for (const response of record.fieldResp) if (!values.has(response.fieldId)) values.set(response.fieldId, response.response);
    return { id: product.id, name: product.name, ncm: product.ncm, fields: product.fields.map((field) => ({ key: field.title, label: field.label, value: values.get(field.id) ?? "" })) };
  }

  async status(userId: string) {
    const broker = await this.broker(userId);
    const config = this.client.config;
    const latest = await this.db.siscomexSyncRun.findFirst({ where: { companyId: { in: broker.companyAccesses.map((item) => item.companyId) }, environment: config.environment }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }], select: { status: true, finishedAt: true } });
    return { enabled: config.enabled, configured: config.configured, environment: config.environment,
      status: !config.enabled ? "DISABLED" : !config.configured ? "NOT_CONFIGURED" : "CONFIGURED", readOnly: true,
      lastSync: latest?.finishedAt.toISOString() ?? null, lastSyncStatus: latest?.status ?? null, cacheTtlSeconds: config.cacheTtlSeconds };
  }
  async testConnection(userId: string) { await this.broker(userId); return this.client.testConnection(); }

  private async resource(companyId: string, subsystem: string, resourceType: string, resourceKey: string, force: boolean, fetcher: () => Promise<unknown>, validate: (payload: unknown) => unknown) {
    const config = this.client.config;
    if (!config.enabled) throw new SiscomexError("SISCOMEX_NOT_CONFIGURED", "A integração SISCOMEX está desabilitada no servidor.", 503);
    const where = { companyId, environment: config.environment, subsystem, resourceType, resourceKey };
    const latest = await this.db.siscomexSnapshot.findFirst({ where, orderBy: [{ fetchedAt: "desc" }, { id: "desc" }] });
    return cachedResource({ latest, ttl: config.cacheTtlSeconds, force, fetchAndSave: async () => {
      const payload = await fetcher();
      validate(payload); // An invalid payload must not poison a previously valid snapshot.
      const clean = json(payload);
      return this.db.siscomexSnapshot.create({ data: { ...where, payload: clean ?? Prisma.JsonNull, payloadHash: createHash("sha256").update(JSON.stringify(clean)).digest("hex") } });
    } });
  }

  async catalog(userId: string, companyId: string, refresh = false, operators = false) {
    const company = await this.company(userId, companyId);
    const resourceType = operators ? "OPERATORS" : "CATALOG";
    const mapper = (payload: unknown) => payloadItems(payload, operators ? ["operadores", "items", "data"] : ["produtos", "items", "data"]).map((entry) => {
      const mapped = operators ? mapOperator(entry) : mapProduct(entry);
      if (mapped.responsibleRootId && mapped.responsibleRootId !== company.root) throw new SiscomexError("SISCOMEX_SCOPE_MISMATCH", "O SISCOMEX retornou dados de outra empresa.");
      return mapped;
    });
    if (!refresh) {
      const snapshot = await this.db.siscomexSnapshot.findFirst({ where: { companyId, environment: this.client.config.environment, resourceType, resourceKey: company.root }, orderBy: [{ fetchedAt: "desc" }, { id: "desc" }] });
      return { items: snapshot ? mapper(snapshot.payload) : [], cacheStatus: snapshot ? freshness(snapshot.fetchedAt, this.client.config.cacheTtlSeconds) : "UNAVAILABLE", fetchedAt: snapshot?.fetchedAt.toISOString() ?? null, environment: this.client.config.environment, readOnly: true };
    }
    const startedAt = new Date();
    try {
      const resource = await this.resource(companyId, "CATP", resourceType, company.root, true, () => operators ? this.client.listOperators(company.root) : this.client.listProducts(company.root), mapper);
      await this.db.siscomexSyncRun.create({ data: { companyId, actorUserId: userId, environment: this.client.config.environment, status: resource.cacheStatus === "STALE" ? "STALE" : "SUCCESS", errorCode: resource.unavailableReason, startedAt } });
      return { items: mapper(resource.snapshot.payload), cacheStatus: resource.cacheStatus, fetchedAt: resource.snapshot.fetchedAt.toISOString(), environment: this.client.config.environment, readOnly: true };
    } catch (error) { await this.saveFailure(companyId, userId, startedAt, error); throw error; }
  }

  async lookup(userId: string, companyId: string, ncm: string, kind: "attributes" | "ncm", force = false, operationMode = "IMPORTACAO") {
    await this.company(userId, companyId);
    const code = digits(ncm, [8], "NCM");
    const attributes = kind === "attributes";
    const resource = await this.resource(companyId, attributes ? "CADA" : "CLASSIF", attributes ? "ATTRIBUTE_REQUIREMENTS" : "NOMENCLATURE",
      attributes ? `${code}:${operationMode}` : "complete", force,
      () => attributes ? this.client.getAttributes(code, operationMode) : this.client.getNomenclature(),
      (payload) => attributes ? mapRequirements(payload) : mapNcm(payload, code));
    return { ncm: code, environment: this.client.config.environment, cacheStatus: resource.cacheStatus, fetchedAt: resource.snapshot.fetchedAt.toISOString(),
      ...(attributes ? { requirements: mapRequirements(resource.snapshot.payload) } : { officialNcm: mapNcm(resource.snapshot.payload, code), classificationAssigned: false }), readOnly: true };
  }

  async comparison(userId: string, companyId: string, productId: string) {
    await this.company(userId, companyId);
    const local = await this.product(companyId, productId);
    const run = await this.db.siscomexSyncRun.findFirst({ where: { companyId, productId, environment: this.client.config.environment, status: { in: ["SUCCESS", "STALE"] } }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }] });
    if (!run?.result) return null;
    const stored = run.result as unknown as StoredResult;
    if (!object(stored).officialProduct) return null;
    return { ...stored, id: run.id, environment: run.environment, fetchedAt: run.finishedAt.toISOString(),
      cacheStatus: stored.cacheStatus === "STALE" || stored.snapshots.some((item) => freshness(item.fetchedAt, this.client.config.cacheTtlSeconds) === "STALE") ? "STALE" : "FRESH",
      diff: compareProduct(local, stored.officialProduct, stored.requirements, stored.officialOperator), readOnly: true };
  }

  async sync(userId: string, companyId: string, productId: string, input: SyncInput) {
    const company = await this.company(userId, companyId);
    const local = await this.product(companyId, productId);
    const startedAt = new Date();
    try {
      const product = await this.resource(companyId, "CATP", "PRODUCT", `${company.root}:${input.productCode}:${input.version}`, Boolean(input.force),
        () => this.client.getProduct(company.root, input.productCode, input.version), (payload) => {
          const mapped = mapProduct(payload);
          if (mapped.responsibleRootId !== company.root || Number(mapped.productCode) !== Number(input.productCode) || mapped.version !== input.version) {
            throw new SiscomexError("SISCOMEX_SCOPE_MISMATCH", "O SISCOMEX retornou uma referência diferente da solicitada.");
          }
        });
      const officialProduct = mapProduct(product.snapshot.payload);
      const ncm = digits(officialProduct.ncm || local.ncm, [8], "NCM");
      const attributes = await this.resource(companyId, "CADA", "ATTRIBUTE_REQUIREMENTS", `${ncm}:${input.operationMode}`, Boolean(input.force), () => this.client.getAttributes(ncm, input.operationMode), mapRequirements);
      const resources = [product, attributes];
      let officialOperator: OfficialOperator | null = null;
      if (input.foreignOperator) {
        const operator = input.foreignOperator;
        const resource = await this.resource(companyId, "CATP", "FOREIGN_OPERATOR", `${company.root}:${operator.country}:${operator.code}:${operator.version}`, Boolean(input.force),
          () => this.client.getOperator(company.root, operator.country, operator.code, operator.version), (payload) => {
            const mapped = mapOperator(payload);
            if (mapped.responsibleRootId !== company.root) throw new SiscomexError("SISCOMEX_SCOPE_MISMATCH", "Operador retornado fora desta empresa.");
          });
        resources.push(resource);
        officialOperator = mapOperator(resource.snapshot.payload);
      }
      const requirements = mapRequirements(attributes.snapshot.payload);
      const diff = compareProduct(local, officialProduct, requirements, officialOperator);
      const result: StoredResult = { officialProduct, officialOperator, requirements, diff,
        cacheStatus: resources.some((resource) => resource.cacheStatus === "STALE") ? "STALE" : "FRESH",
        snapshots: resources.map((resource) => ({ id: resource.snapshot.id, resourceType: resource.snapshot.resourceType, payloadHash: resource.snapshot.payloadHash, fetchedAt: resource.snapshot.fetchedAt.toISOString(), cacheStatus: resource.cacheStatus })) };
      const run = await this.db.$transaction(async (tx) => {
        // Same-product syncs serialize so repeated clicks do not duplicate notifications.
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} AND "importerId" = ${companyId} FOR UPDATE`;
        const previous = await tx.siscomexSyncRun.findFirst({ where: { companyId, productId, environment: this.client.config.environment, status: { in: ["SUCCESS", "STALE"] } }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }] });
        const previousDiff = object(previous?.result).diff;
        const created = await tx.siscomexSyncRun.create({ data: { companyId, productId, actorUserId: userId, environment: this.client.config.environment, status: result.cacheStatus === "STALE" ? "STALE" : "SUCCESS", result: json(result), startedAt } });
        if (result.cacheStatus === "FRESH" && diff.requiresReview && canonicalJson(previousDiff) !== canonicalJson(diff)) {
          await recordActivity(tx, { companyId, actorUserId: userId, productId, type: "CATALOG_INCONSISTENCY_FOUND", visibility: "DISPATCHER_ONLY", entityType: "PRODUCT", entityId: productId, metadata: { source: "SISCOMEX", count: diff.conflictCount + diff.missingRequiredAttributes.length + Number(diff.inactive), conflictCount: diff.conflictCount, missingRequiredCount: diff.missingRequiredAttributes.length, syncRunId: created.id } });
          await createNotification(tx, { userId, action: "Revisar comparação SISCOMEX", description: `O produto ${local.name} possui divergências ou atributos a revisar. O catálogo não foi alterado.`, entityType: "product", entityId: productId });
        }
        return created;
      });
      return { ...result, id: run.id, environment: this.client.config.environment, fetchedAt: run.finishedAt.toISOString(), readOnly: true };
    } catch (error) { await this.saveFailure(companyId, userId, startedAt, error, productId); throw error; }
  }

  private async saveFailure(companyId: string, userId: string, startedAt: Date, error: unknown, productId?: string) {
    await this.db.siscomexSyncRun.create({ data: { companyId, productId, actorUserId: userId, environment: this.client.config.environment,
      status: error instanceof SiscomexError && error.code === "SISCOMEX_RATE_LIMITED" ? "RATE_LIMITED" : "UNAVAILABLE",
      errorCode: error instanceof SiscomexError ? error.code : "SISCOMEX_SYNC_FAILED", startedAt } });
  }
}
