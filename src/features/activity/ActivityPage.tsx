import { useEffect, useState } from "react";
import type { AppUser } from "../../data";
import { Glyph } from "../../icons";
import { Dropdown } from "../../ui";
import { getActivities, getActivityOptions } from "./activityApi";
import { presentActivity } from "./activityPresenter";
import type { ActivityDTO, ActivityFilters, ActivityOptions } from "./activityTypes";
import "./activity.css";

const initialFilters: ActivityFilters = { companyId: "", actorId: "", category: "", date: "Mais recentes" };
const categories: readonly [string, string][] = [["", "Todos"], ["requests", "Solicitações"], ["products", "Produtos"], ["corrections", "Correções"], ["system", "Sistema"]];

export function ActivityPage({ viewer, importer = false, onNavigate }: { viewer: AppUser; importer?: boolean; onNavigate?: (target: "product" | "request") => void }) {
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState<ActivityOptions>({ companies: [], actors: [] });
  const [items, setItems] = useState<ActivityDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { getActivityOptions(viewer, filters.companyId || undefined).then(setOptions).catch((cause: Error) => setError(cause.message)); }, [viewer, filters.companyId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getActivities(viewer, filters).then((page) => { if (active) { setItems(page.items); setNextCursor(page.nextCursor); } }).catch((cause: Error) => active && setError(cause.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [viewer, filters]);
  const update = (key: keyof ActivityFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const loadMore = () => nextCursor && getActivities(viewer, filters, nextCursor).then((page) => { setItems((current) => [...current, ...page.items]); setNextCursor(page.nextCursor); }).catch((cause: Error) => setError(cause.message));
  return <>
    <div className="ws-page-title"><div><h1>Atividade</h1><p>Um registro cronológico de mudanças no catálogo.</p></div></div>
    <div className="ws-card ws-card--large activity-card">
      <div className="ws-tools">
        {!importer && <Dropdown label="Cliente" options={[["", "Todos"], ...options.companies.map((company) => [company.id, company.name] as const)]} value={filters.companyId} onChange={(value) => update("companyId", value)} hideAllLabel ariaLabel="Filtrar por Cliente" />}
        <Dropdown label="Usuário" options={[["", "Todos"], ...options.actors.map((actor) => [actor.id, actor.name] as const)]} value={filters.actorId} onChange={(value) => update("actorId", value)} hideAllLabel ariaLabel="Filtrar por Usuário" />
        <Dropdown label="Tipo" options={categories} value={filters.category} onChange={(value) => update("category", value)} hideAllLabel ariaLabel="Filtrar por Tipo" />
        <Dropdown label="Data" options={["Mais recentes", "Mais antigas", "Hoje", "Últimos 7 dias", "Últimos 30 dias"]} value={filters.date} onChange={(value) => update("date", value)} ariaLabel="Filtrar por Data" />
      </div>
      {loading && <p className="ws-empty">Carregando atividades…</p>}
      {!loading && error && <p className="ws-empty" role="alert">{error}</p>}
      {!loading && !error && <div className="ws-timeline">
        {items.map((activity) => { const copy = presentActivity(activity, viewer.id); const target = activity.product ? "product" : activity.request ? "request" : null; return <button key={activity.id} onClick={() => target && onNavigate?.(target)} disabled={!target}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(activity.createdAt))}</time><span /><p><strong>{copy.title}</strong>{copy.subtitle}</p>{target && <Glyph name="arrow" />}</button>; })}
        {items.length === 0 && <p className="ws-empty">Nenhuma atividade encontrada para estes filtros.</p>}
      </div>}
      {!loading && nextCursor && <button className="ws-quiet activity-more" onClick={loadMore}>Carregar mais</button>}
    </div>
  </>;
}
