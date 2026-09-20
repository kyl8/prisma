import { useEffect, useState } from "react";
import type { AppUser } from "../../data";
import { Glyph } from "../../icons";
import { Dropdown } from "../../ui";
import { getActivities, getActivityOptions } from "./activityApi";
import { presentActivity } from "./activityPresenter";
import type { ActivityDTO, ActivityFilters, ActivityOptions } from "./activityTypes";
import "./activity.css";

const initialFilters: ActivityFilters = { companyId: "", actorId: "", category: "", date: "Mais recentes" };
const categories: readonly [string, string][] = [["Todos", ""], ["Solicitações", "requests"], ["Produtos", "products"], ["Correções", "corrections"], ["Sistema", "system"]];

export function ActivityPage({ viewer, importer = false, onNavigate }: { viewer: AppUser; importer?: boolean; onNavigate?: (target: "product" | "request", entityId?: string, companyId?: string) => void }) {
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState<ActivityOptions>({ companies: [], actors: [] });
  const [items, setItems] = useState<ActivityDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => { setLoading(true); setError(""); getActivities(viewer, filters).then((page) => { setItems(page.items); setNextCursor(page.nextCursor); }).catch(() => setError("Não foi possível carregar as atividades.")).finally(() => setLoading(false)); };
  useEffect(() => { getActivityOptions(viewer, filters.companyId || undefined).then(setOptions).catch(() => setError("Não foi possível carregar as atividades.")); }, [viewer, filters.companyId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getActivities(viewer, filters).then((page) => { if (active) { setItems(page.items); setNextCursor(page.nextCursor); } }).catch(() => active && setError("Não foi possível carregar as atividades.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [viewer, filters]);
  const update = (key: keyof ActivityFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const loadMore = () => nextCursor && getActivities(viewer, filters, nextCursor).then((page) => { setItems((current) => [...current, ...page.items]); setNextCursor(page.nextCursor); }).catch(() => setError("Não foi possível carregar as atividades."));
  return <>
    <div className="ws-page-title"><div><h1>Atividade</h1><p>Um registro cronológico de mudanças no catálogo.</p></div></div>
    <div className="ws-card ws-card--large activity-card">
      <div className="ws-tools">
        {!importer && <Dropdown label="Cliente" options={[["Todos", ""], ...options.companies.map((company) => [company.name, company.id] as const)]} value={filters.companyId} onChange={(value) => update("companyId", value)} hideAllLabel ariaLabel="Filtrar por Cliente" />}
        <Dropdown label="Usuário" options={[["Todos", ""], ...options.actors.map((actor) => [actor.name, actor.id] as const)]} value={filters.actorId} onChange={(value) => update("actorId", value)} hideAllLabel ariaLabel="Filtrar por Usuário" />
        <Dropdown label="Tipo" options={categories} value={filters.category} onChange={(value) => update("category", value)} hideAllLabel ariaLabel="Filtrar por Tipo" />
        <Dropdown label="Data" options={["Mais recentes", "Mais antigas", "Hoje", "Últimos 7 dias", "Últimos 30 dias"]} value={filters.date} onChange={(value) => update("date", value)} ariaLabel="Filtrar por Data" />
      </div>
      {loading && <p className="ws-empty">Carregando atividades…</p>}
      {!loading && error && <div className="ws-empty" role="alert"><p>Não foi possível carregar as atividades.</p><button className="ws-quiet" onClick={load}>Tentar novamente</button></div>}
      {!loading && !error && <div className="ws-timeline">
        {items.map((activity) => { const copy = presentActivity(activity, viewer.id); const target = activity.product ? "product" : activity.request ? "request" : null; return <button key={activity.id} onClick={() => target && onNavigate?.(target, activity.product?.id ?? activity.request?.id, activity.company.id)} disabled={!target}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(activity.createdAt))}</time><span /><p><strong>{copy.title}</strong>{copy.subtitle}</p>{target && <Glyph name="arrow" />}</button>; })}
        {items.length === 0 && <p className="ws-empty">Nenhuma atividade encontrada para estes filtros.</p>}
      </div>}
      {!loading && nextCursor && <button className="ws-quiet activity-more" onClick={loadMore}>Carregar mais</button>}
    </div>
  </>;
}
