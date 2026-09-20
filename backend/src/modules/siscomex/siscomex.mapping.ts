import { SiscomexError } from "./siscomex.client";

type ObjectValue = Record<string, unknown>;
export const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string | null => value === undefined || value === null || value === "" ? null : String(value);
const yes = (value: unknown) => value === true || value === 1 || ["true", "sim", "s", "1"].includes(String(value).toLowerCase());
export const hasValue = (value: unknown): boolean => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "") && (!Array.isArray(value) || value.length > 0);

// PostgreSQL JSONB does not preserve object key order. Audit deduplication must
// compare content, not the insertion order of keys returned by the driver.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function payloadItems(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const raw = object(payload);
  for (const key of keys) if (Array.isArray(raw[key])) return raw[key] as unknown[];
  if (payload === null) return [];
  throw new SiscomexError("SISCOMEX_INVALID_RESPONSE", "O SISCOMEX retornou uma lista em formato inesperado.");
}

export function mapProduct(payload: unknown) {
  const raw = object(payload);
  if (!hasValue(raw.codigo) || !hasValue(raw.versao)) throw new SiscomexError("SISCOMEX_INVALID_RESPONSE", "O SISCOMEX retornou um produto sem código ou versão.");
  const attributes = [
    ...array(raw.atributos).map((entry) => { const item = object(entry); return { code: text(item.atributo), value: item.valor ?? null, multivalued: false, compound: false }; }),
    ...["atributosMultivalorados", "atributosCompostos", "atributosCompostosMultivalorados"].flatMap((key) => array(raw[key]).map((entry) => {
      const item = object(entry);
      return { code: text(item.atributo), value: item.valores ?? [], multivalued: key.includes("Multivalorados"), compound: key.includes("Compostos") };
    })),
  ].filter((item): item is typeof item & { code: string } => Boolean(item.code));
  return {
    source: "SISCOMEX_CATP" as const,
    responsibleRootId: text(raw.cpfCnpjRaiz), productCode: String(raw.codigo).padStart(10, "0"), version: String(raw.versao),
    status: text(raw.situacao), operationMode: text(raw.modalidade), ncm: text(raw.ncm), denomination: text(raw.denominacao),
    complementaryDescription: text(raw.descricao), internalProductCodes: array(raw.codigosInterno).map(String), referenceDate: text(raw.dataReferencia), attributes,
  };
}
export type OfficialProduct = ReturnType<typeof mapProduct>;

export function mapOperator(payload: unknown) {
  const raw = object(payload);
  if (!hasValue(raw.codigo)) throw new SiscomexError("SISCOMEX_INVALID_RESPONSE", "O SISCOMEX retornou um operador sem código.");
  return {
    source: "SISCOMEX_CATP" as const, responsibleRootId: text(raw.cpfCnpjRaiz), operatorCode: String(raw.codigo),
    version: text(raw.versao), status: text(raw.situacao), country: text(raw.codigoPais), tin: text(raw.tin),
    name: text(raw.nome), email: text(raw.email), postalCode: text(raw.cep), street: text(raw.logradouro), city: text(raw.nomeCidade),
    subdivision: text(raw.codigoSubdivisaoPais), internalCode: text(raw.codigoInterno), referenceDate: text(raw.dataReferencia),
    additionalIdentifiers: array(raw.identificacoesAdicionais),
  };
}
export type OfficialOperator = ReturnType<typeof mapOperator>;
export type AttributeRequirement = {
  code: string; name: string; description: string | null; required: boolean; conditional: boolean;
  multivalued: boolean; compound: boolean; domain: unknown[]; conditions: unknown; validFrom: string | null; validTo: string | null;
};

export function mapRequirements(payload: unknown): AttributeRequirement[] {
  const list = Array.isArray(payload) ? payload : payload === null ? [] : object(payload).codigo ? [payload] : payloadItems(payload, ["atributos", "listaAtributos"]);
  const result: AttributeRequirement[] = [];
  const add = (raw: ObjectValue, conditional = false, conditions: unknown = null) => {
    if (!hasValue(raw.codigo)) return;
    result.push({
      code: String(raw.codigo), name: text(raw.nomeApresentacao ?? raw.nome) || String(raw.codigo), description: text(raw.definicao),
      required: yes(raw.obrigatorio), conditional, multivalued: yes(raw.multivalorado),
      compound: raw.formaPreenchimento === "COMPOSTO" || array(raw.listaSubatributos).length > 0,
      domain: array(raw.dominio), conditions, validFrom: text(raw.dataInicioVigencia), validTo: text(raw.dataFimVigencia),
    });
  };
  for (const entry of list) {
    const raw = object(entry);
    add(raw);
    for (const conditionalEntry of array(raw.condicionados)) {
      const conditioned = object(conditionalEntry);
      add({ ...object(conditioned.atributo), ...Object.fromEntries(["obrigatorio", "multivalorado", "dataInicioVigencia", "dataFimVigencia"].filter((key) => conditioned[key] !== undefined).map((key) => [key, conditioned[key]])) }, true,
        { description: conditioned.descricaoCondicao ?? null, expression: conditioned.condicao ?? null, conditioningAttribute: raw.codigo });
    }
  }
  return [...new Map(result.map((item) => [`${item.code}:${item.conditional}:${JSON.stringify(item.conditions)}`, item])).values()];
}

export function mapNcm(payload: unknown, ncm: string) {
  const entry = payloadItems(payload, ["Nomenclaturas", "nomenclaturas", "itens", "listaNcm", "ncms"])
    .map(object).find((item) => String(item.Codigo ?? item.codigo ?? item.ncm ?? item.code ?? "").replace(/\D/g, "") === ncm);
  return entry ? { ncm, description: text(entry.Descricao ?? entry.descricao ?? entry.description), validFrom: text(entry.Data_Inicio ?? entry.dataInicioVigencia), validTo: text(entry.Data_Fim ?? entry.dataFimVigencia), statisticalUnit: text(entry.unidadeEstatistica) } : null;
}

export type LocalProduct = { id: string; name: string; ncm: string; fields: { key: string; label: string; value: string }[] };
type Difference = { field: string; label: string; localValue: unknown; officialValue: unknown; status: "matching" | "conflict" | "official_only" | "local_only" };

function normalize(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) return `[${value.map(normalize).join(",")}]`;
    return JSON.stringify(Object.entries(object(value)).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, normalize(val)]));
  }
  const valueText = String(value ?? "").trim();
  if (/^[\[{]/.test(valueText)) { try { return normalize(JSON.parse(valueText)); } catch { /* compare as text */ } }
  return valueText.toLocaleLowerCase("pt-BR");
}

/** Compares approved/persisted local answers. Never applies official values or assigns an NCM. */
export function compareProduct(local: LocalProduct, official: OfficialProduct, requirements: AttributeRequirement[] = [], operator: OfficialOperator | null = null) {
  const fields = new Map(local.fields.map((field) => [field.key.toUpperCase(), field]));
  const result: Difference[] = [];
  const compared = new Set<string>();
  const add = (field: string, label: string, localValue: unknown, officialValue: unknown, ncm = false) => {
    compared.add(field.toUpperCase());
    if (!hasValue(localValue) && !hasValue(officialValue)) return;
    const equal = ncm ? String(localValue).replace(/\D/g, "") === String(officialValue).replace(/\D/g, "") : normalize(localValue) === normalize(officialValue);
    result.push({ field, label, localValue: localValue ?? null, officialValue: officialValue ?? null,
      status: !hasValue(localValue) ? "official_only" : !hasValue(officialValue) ? "local_only" : equal ? "matching" : "conflict" });
  };
  add("name", "Nome do produto", local.name, official.denomination);
  add("ncm", "NCM", local.ncm, official.ncm, true);
  if (operator) add("manufacturer", "Fabricante / produtor", fields.get("MANUFACTURER")?.value, operator.name);
  for (const attribute of official.attributes) {
    const localField = fields.get(attribute.code.toUpperCase());
    add(attribute.code, requirements.find((item) => item.code === attribute.code)?.name || localField?.label || attribute.code, localField?.value, attribute.value);
  }
  for (const field of local.fields) if (!compared.has(field.key.toUpperCase())) add(field.key, field.label, field.value, null);
  const missingRequiredAttributes = requirements.filter((item) => item.required && !item.conditional && !hasValue(fields.get(item.code.toUpperCase())?.value));
  // Conditions are surfaced for human review; never assumed to be applicable.
  const conditionalAttributes = requirements.filter((item) => item.conditional && !hasValue(fields.get(item.code.toUpperCase())?.value));
  const inactive = ["desativado", "inativo", "1"].includes(normalize(official.status));
  return { productId: local.id, fields: result, missingRequiredAttributes, conditionalAttributes, inactive,
    conflictCount: result.filter((field) => field.status === "conflict").length,
    requiresReview: result.some((field) => field.status === "conflict") || missingRequiredAttributes.length > 0 || inactive,
    classificationAssigned: false as const, catalogChanged: false as const };
}
