import { useEffect, useId, useState } from "react";
import { Dropdown } from "../../ui";
import { Glyph } from "../../icons";
import { compareWithSiscomex, getComparison, getOfficialCatalog, getOfficialOperators, getSiscomexStatus, lookupAttributes, lookupNcm, type AttributeLookup, type Comparison, type IntegrationStatus, type NcmLookup, type OfficialCatalog, type OfficialOperator, type OfficialProduct } from "./siscomexApi";
import { environmentLabel, formatConsultationDate } from "./SiscomexSettings";
import "./siscomex.css";

type ProductOption = { id: string; name: string; sku: string; ncm: string };
type PanelProps = { companyId: string; products: ProductOption[]; initialProductId?: string };
const displayValue = (value: unknown): string => value === undefined || value === null || value === "" ? "Não informado" : typeof value === "boolean" ? value ? "Sim" : "Não" : typeof value === "object" ? JSON.stringify(value) : String(value);
const diffLabel = { matching: "Igual", conflict: "Divergência", official_only: "Somente no SISCOMEX", local_only: "Somente no PRISMA" };

export function SiscomexPanel(props: PanelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="siscomex-entry">
    <button type="button" className="ws-quiet" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Glyph name="boxes" />{open ? "Fechar consulta SISCOMEX" : "Consultar SISCOMEX"}</button>
    {open && <div id={id}><Consultation key={props.companyId} {...props} /></div>}
  </div>;
}

function Consultation({ companyId, products, initialProductId }: PanelProps) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [catalog, setCatalog] = useState<OfficialCatalog<OfficialProduct> | null>(null);
  const [operators, setOperators] = useState<OfficialCatalog<OfficialOperator> | null>(null);
  const [productId, setProductId] = useState(initialProductId || products[0]?.id || "");
  const [code, setCode] = useState("");
  const [version, setVersion] = useState("");
  const [mode, setMode] = useState("IMPORTACAO");
  const [operatorKey, setOperatorKey] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [ncmResult, setNcmResult] = useState<NcmLookup | null>(null);
  const [attributes, setAttributes] = useState<AttributeLookup | null>(null);
  const [busy, setBusy] = useState("");
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [error, setError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const currentProduct = products.find((product) => product.id === productId);
  const blocked = !status?.enabled || !status.configured;
  const operatorValue = (operator: OfficialOperator) => `${operator.country}:${operator.operatorCode}:${operator.version}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getSiscomexStatus(controller.signal), getOfficialCatalog(companyId, false, controller.signal)])
      .then(([newStatus, result]) => { setStatus(newStatus); setCatalog(result); })
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [companyId]);

  useEffect(() => {
    setComparison(null); setCode(""); setVersion(""); setNcmResult(null); setAttributes(null); setComparisonError(""); setOperatorKey("");
    if (!productId) return;
    const controller = new AbortController();
    setLoadingComparison(true);
    getComparison(companyId, productId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setComparison(result); setCode(result?.officialProduct.productCode || ""); setVersion(result?.officialProduct.version || "");
    }).catch((error: Error) => { if (!controller.signal.aborted) setComparisonError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingComparison(false); });
    return () => controller.abort();
  }, [companyId, productId]);

  const run = async (action: string, work: () => Promise<void>) => {
    setBusy(action); setError("");
    try { await work(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível concluir a consulta."); }
    finally { setBusy(""); }
  };
  const compare = () => run("compare", async () => {
    const operator = operators?.items.find((item) => operatorValue(item) === operatorKey);
    const result = await compareWithSiscomex(companyId, productId, { productCode: code, version, force: true, operationMode: mode,
      ...(operator && operator.country && operator.version ? { foreignOperator: { code: operator.operatorCode, country: operator.country, version: operator.version } } : {}) });
    setComparison(result); setComparisonError("");
    // Refresh existing activity/notification consumers without changing the local catalog.
    window.dispatchEvent(new Event("prisma:siscomex-updated"));
  });
  const lookup = () => run("ncm", async () => {
    if (!currentProduct) return;
    setNcmResult(null); setAttributes(null);
    const results = await Promise.allSettled([lookupNcm(companyId, currentProduct.ncm), lookupAttributes(companyId, currentProduct.ncm, mode)]);
    if (results[0].status === "fulfilled") setNcmResult(results[0].value);
    if (results[1].status === "fulfilled") setAttributes(results[1].value);
    const failed = results.find((item) => item.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  });

  return <section className="siscomex-panel" aria-label="Consulta SISCOMEX" aria-busy={Boolean(busy) || loadingComparison}>
    <header className="siscomex-heading"><div><h2>Referências do SISCOMEX</h2><p>Consulte e compare os dados oficiais. Seu catálogo permanece inalterado.</p></div><span className="siscomex-tag">{status ? environmentLabel(status.environment) : "Consultando…"} · Somente leitura</span></header>
    {error && <p className="siscomex-error" role="alert">{error}</p>}
    {status && blocked && <p className="siscomex-notice">A integração ainda não está habilitada com as chaves de acesso. Consulte os detalhes em Configurações → Integrações → SISCOMEX. Consultas anteriores continuam disponíveis abaixo, quando existirem.</p>}
    {!status && error && <button type="button" className="ws-quiet" disabled={Boolean(busy)} onClick={() => void run("status", async () => setStatus(await getSiscomexStatus()))}>Tentar novamente</button>}
    <div className="siscomex-heading siscomex-subheading"><div><h3>Catálogo oficial</h3><p>{catalog?.fetchedAt ? `${catalog.items.length} produtos · Consultado em ${formatConsultationDate(catalog.fetchedAt)}` : "Nenhuma consulta salva para esta empresa."}</p></div>
      <button type="button" className="ws-quiet" disabled={blocked || Boolean(busy) || loadingComparison} onClick={() => void run("catalog", async () => setCatalog(await getOfficialCatalog(companyId, true)))}>{busy === "catalog" ? "Consultando catálogo…" : "Consultar catálogo oficial"}</button></div>
    {catalog?.cacheStatus === "STALE" && <p className="siscomex-notice" role="status">Esta é uma cópia desatualizada. Consulte novamente antes de tomar uma decisão.</p>}
    {catalog?.fetchedAt && catalog.items.length === 0 && <p className="siscomex-meta">O SISCOMEX não retornou produtos para este catálogo.</p>}
    {products.length === 0 ? <p className="siscomex-notice">Cadastre um produto no PRISMA para comparar com uma referência oficial.</p> : <>
      <fieldset className="siscomex-form" disabled={Boolean(busy) || loadingComparison}>
        <legend>Comparar produto</legend>
        <div className="siscomex-fields"><div className="siscomex-field"><span>Produto no PRISMA</span><Dropdown ariaLabel="Produto no PRISMA" options={products.map((product) => [`${product.name} · ${product.sku}`, product.id] as const)} value={productId} onChange={setProductId} /></div>
          <div className="siscomex-field"><span>Modalidade</span><Dropdown ariaLabel="Modalidade SISCOMEX" options={[["Importação", "IMPORTACAO"], ["Exportação", "EXPORTACAO"]]} value={mode} onChange={(value) => { setMode(value); setComparison(null); setAttributes(null); }} /></div></div>
        {Boolean(catalog?.items.length) && <div className="siscomex-field"><span>Referência no SISCOMEX</span><Dropdown ariaLabel="Referência no SISCOMEX" options={[["Selecione um produto oficial", ""], ...(catalog?.items.map((item) => [`${item.denomination || item.productCode} · Código ${item.productCode} · v${item.version}`, `${item.productCode}:${item.version}`] as const) || [])]} value={code && version ? `${code}:${version}` : ""} onChange={(value) => { const [newCode, newVersion] = value.split(":"); setCode(newCode || ""); setVersion(newVersion || ""); setComparison(null); }} /></div>}
        <div className="siscomex-fields"><label className="siscomex-field">Código oficial do produto<input inputMode="numeric" maxLength={10} placeholder="Ex.: 0000000123" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setComparison(null); }} /></label>
          <label className="siscomex-field">Versão oficial<input maxLength={8} placeholder="Ex.: 1" value={version} onChange={(event) => { setVersion(event.target.value); setComparison(null); }} /></label></div>
        <p className="siscomex-meta">Use o código do CATP, não o SKU interno. A empresa é a mesma do catálogo aberto.</p>
        <details className="siscomex-operators"><summary>Incluir operador estrangeiro na comparação (opcional)</summary>
          <button type="button" className="ws-quiet" disabled={blocked} onClick={() => void run("operators", async () => setOperators(await getOfficialOperators(companyId, true)))}>Consultar operadores</button>
          {operators && <><p className="siscomex-meta">{operators.items.length} operadores · {formatConsultationDate(operators.fetchedAt)}{operators.cacheStatus === "STALE" ? " · Cópia desatualizada" : ""}</p><Dropdown ariaLabel="Operador estrangeiro" options={[["Não incluir operador", ""], ...operators.items.filter((item) => item.country && item.version).map((item) => [`${item.name || item.operatorCode} · ${item.country}`, operatorValue(item)] as const)]} value={operatorKey} onChange={(value) => { setOperatorKey(value); setComparison(null); }} /></>}
        </details>
        <div className="siscomex-actions"><button type="button" className="ws-primary" disabled={blocked || !code || !/^\d+(?:\.\d+)*$/.test(version) || !currentProduct} onClick={() => void compare()}>{busy === "compare" ? "Comparando dados…" : "Consultar e comparar"}</button>
          <button type="button" className="ws-quiet" disabled={!status?.enabled || !currentProduct?.ncm} onClick={() => void lookup()}>{busy === "ncm" ? "Consultando NCM…" : "Consultar NCM e atributos"}</button></div>
      </fieldset>
      {loadingComparison && <p role="status" className="siscomex-meta">Carregando a última comparação…</p>}
      {comparisonError && <p role="alert" className="siscomex-error">{comparisonError}</p>}
      {comparison && <ComparisonResult result={comparison} />}
      {ncmResult && <section className="siscomex-result"><h3>NCM {ncmResult.ncm}</h3><p>{ncmResult.officialNcm?.description || "NCM não encontrada na nomenclatura consultada."}</p><p className="siscomex-meta">Consulta de referência, sem classificação automática · {formatConsultationDate(ncmResult.fetchedAt)}{ncmResult.cacheStatus === "STALE" ? " · Cópia desatualizada" : ""}</p></section>}
      {attributes && <section className="siscomex-result"><h3>Atributos oficiais da NCM {attributes.ncm}</h3><p className="siscomex-meta">{formatConsultationDate(attributes.fetchedAt)}{attributes.cacheStatus === "STALE" ? " · Cópia desatualizada" : ""}</p>{attributes.requirements.length ? <ul className="siscomex-requirements">{attributes.requirements.map((item, index) => <li key={`${item.code}-${index}`}><strong>{item.name}</strong><span>{item.code} · {item.conditional ? "Condicional: verificar aplicabilidade" : item.required ? "Obrigatório" : "Opcional"}</span>{item.description && <p>{item.description}</p>}</li>)}</ul> : <p>Nenhum atributo retornado para esta NCM e modalidade.</p>}</section>}
    </>}
  </section>;
}

function ComparisonResult({ result }: { result: Comparison }) {
  return <section className="siscomex-result" aria-label="Resultado da comparação">
    <div className="siscomex-heading"><div><h3>{result.diff.requiresReview ? "Há informações para revisar" : "Comparação concluída"}</h3><p>Código {result.officialProduct.productCode} · Versão {result.officialProduct.version} · {formatConsultationDate(result.fetchedAt)}</p></div><span className="siscomex-tag">{result.diff.conflictCount} divergências</span></div>
    {result.cacheStatus === "STALE" && <p className="siscomex-notice" role="status">Comparação com dados oficiais desatualizados. Nenhuma alteração foi aplicada; consulte novamente para validar.</p>}
    {result.diff.inactive && <p className="siscomex-notice">O produto oficial está desativado. Revise a referência utilizada.</p>}
    <div className="siscomex-comparison">{result.diff.fields.map((field) => <div className="siscomex-diff-row" key={field.field}><div><strong>{field.label}</strong><span className={`siscomex-diff-status ${field.status === "conflict" ? "is-conflict" : ""}`}>{diffLabel[field.status]}</span></div><div><small>PRISMA</small><p>{displayValue(field.localValue)}</p></div><div><small>SISCOMEX</small><p>{displayValue(field.officialValue)}</p></div></div>)}</div>
    {result.diff.missingRequiredAttributes.length > 0 && <div className="siscomex-result"><h4>Atributos obrigatórios não preenchidos no PRISMA</h4><ul>{result.diff.missingRequiredAttributes.map((item) => <li key={item.code}>{item.name} <span className="siscomex-meta">({item.code})</span></li>)}</ul></div>}
    {result.diff.conditionalAttributes.length > 0 && <div className="siscomex-result"><h4>Atributos condicionais para conferir</h4><p className="siscomex-meta">A aplicabilidade depende da condição oficial. Não são tratados automaticamente como pendências.</p><ul>{result.diff.conditionalAttributes.map((item, index) => <li key={`${item.code}-${index}`}>{item.name} ({item.code})</li>)}</ul></div>}
    <p className="siscomex-meta">Esta consulta não aprova nem altera o produto. Use o fluxo de revisão do PRISMA para corrigir os dados.</p>
  </section>;
}
