import { useEffect, useState } from "react";
import { getSiscomexStatus, testSiscomexConnection, type IntegrationStatus } from "./siscomexApi";
import "./siscomex.css";

export const formatConsultationDate = (value: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não consultado";
export const environmentLabel = (value?: string) => value === "production" ? "Produção" : "Validação";

export function SiscomexSettings() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getSiscomexStatus(controller.signal).then(setStatus).catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  const refresh = async (test: boolean) => {
    setBusy(true); setError(""); setConnected(false);
    try {
      const current = await getSiscomexStatus(); setStatus(current);
      if (test) { await testSiscomexConnection(); setConnected(true); }
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível consultar a integração."); }
    finally { setBusy(false); }
  };
  const label = connected ? "Conexão verificada" : !status ? "Consultando configuração…" : !status.enabled ? "Desabilitado" : !status.configured ? "Chaves não configuradas" : "Configurado · conexão não testada";
  return <section className="siscomex-settings" aria-label="Integração SISCOMEX" aria-busy={busy}>
    <div className="siscomex-heading"><div><h3>SISCOMEX</h3><p role="status">{error && !status ? "Não foi possível consultar o status" : label}</p></div><button type="button" className="ws-quiet" aria-expanded={details} onClick={() => setDetails(!details)}>{details ? "Ocultar detalhes" : "Ver detalhes"}</button></div>
    {status && <p className="siscomex-meta">{environmentLabel(status.environment)} · Somente leitura · Última consulta: {formatConsultationDate(status.lastSync)}</p>}
    {error && <p className="siscomex-error" role="alert">{error}</p>}
    {connected && <p className="siscomex-notice" role="status">Autenticação confirmada. O acesso a cada empresa é verificado pelo SISCOMEX durante a consulta.</p>}
    {details && <div className="siscomex-settings-details">
      <p>As chaves ficam somente no servidor. Configure <code>SISCOMEX_CLIENT_ID</code>, <code>SISCOMEX_CLIENT_SECRET</code> e <code>SISCOMEX_ENABLED=true</code> no ambiente do backend.</p>
      <p>Para produção, configure também <code>SISCOMEX_ENV=production</code> e <code>SISCOMEX_ALLOW_PRODUCTION=true</code>. As chaves precisam permitir acesso às empresas consultadas.</p>
      <a href="https://docs.portalunico.siscomex.gov.br/pages/chaves-acesso/" target="_blank" rel="noreferrer">Como gerar as chaves no Portal Único</a>
      <p>Abra o catálogo de um cliente e selecione “Consultar SISCOMEX” para comparar as informações. Nenhum produto será enviado, aprovado ou alterado automaticamente.</p>
    </div>}
    <div className="siscomex-actions"><button type="button" className="ws-quiet" disabled={busy} onClick={() => void refresh(false)}>Atualizar status</button><button type="button" className="ws-primary" disabled={busy || !status?.enabled || !status.configured} onClick={() => void refresh(true)}>{busy ? "Consultando…" : "Testar conexão"}</button></div>
  </section>;
}
