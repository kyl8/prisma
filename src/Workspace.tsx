import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CatalogRequest, type Product } from "./data";
import { Glyph, GlyphName } from "./icons";
import {
  addCompany,
  addCustomField,
  approveProduct,
  createCatalogRequest,
  customFieldsOf,
  dispatcherStatusLabel,
  login,
  markNotificationRead,
  navigate,
  productCompleteness,
  productsForCompany,
  removeCustomField,
  removeProduct,
  requestCorrection,
  requestStatusLabel,
  showToast,
  useCurrentUser,
  useStoreState,
} from "./store";
import { ThemeToggle } from "./theme";
import { Dropdown, Modal, NoticePopover, SoundToggle } from "./ui";
import { playUISound } from "./utils/uiSounds";
import { approveBackendCatalogRequest, cancelBackendCatalogRequest, createBackendCatalogRequest, createWorkspaceCompany, deleteBackendCatalogRequest, getCatalogRequestReview, listCatalogCompanies, listCompanyCatalogRequests, listWorkspaceCompanies, rejectBackendCatalogRequest, reissueCatalogRequest, updateBackendCatalogRequest, type BackendCompany, type WorkspaceCompany } from "./features/catalog-request/api/catalogRequestApi";
import { ActivityPage } from "./features/activity/ActivityPage";
import "./workspace.css";

type View =
  | "overview"
  | "requests"
  | "clients"
  | "client"
  | "catalog"
  | "product"
  | "review"
  | "pending"
  | "pending-detail"
  | "import"
  | "import-result"
  | "activity"
  | "users"
  | "settings"
  | "assistant"
  | "add-client"
  | "create-product";

const clients = [
  [
    "Atlas Importações",
    "12.345.678/0001-90",
    "182 produtos",
    "94%",
    "11 pendências",
    "Importador",
    "Hoje",
    "Em andamento",
  ],
  [
    "Ocean Trade",
    "32.147.890/0001-12",
    "76 produtos",
    "78%",
    "17 pendências",
    "Importador",
    "Ontem",
    "Atenção necessária",
  ],
  [
    "Brava Equipamentos",
    "06.551.481/0001-44",
    "48 produtos",
    "100%",
    "0 pendências",
    "—",
    "12 set",
    "Completo",
  ],
];

type WorkspaceActivityItem = WorkspaceCompany["activity"][number];

function activityTitle(type: string) {
  const titles: Record<string, string> = {
    REQUEST_CREATED: "Solicitação criada", REQUEST_STARTED: "Preenchimento iniciado", REQUEST_SUBMITTED: "Informações enviadas para revisão",
    PRODUCT_UPDATED: "Produto atualizado", PRODUCT_SUBMITTED: "Produto enviado para revisão", PRODUCT_APPROVED: "Produto aprovado",
    CORRECTION_REQUESTED: "Correção solicitada", CORRECTION_RESOLVED: "Correção respondida", REMINDER_SENT: "Lembrete enviado",
    CATALOG_IMPORTED: "Catálogo importado", CATALOG_INCONSISTENCY_FOUND: "Inconsistências encontradas",
  };
  return titles[type] ?? "Atividade registrada";
}

function RealActivityList({ items, go }: { items: WorkspaceActivityItem[]; go: (v: View) => void }) {
  return <div className="ws-timeline">
    {items.map((item) => <button key={item.id} onClick={() => go(item.requestId ? "requests" : item.productName ? "catalog" : "activity")}>
      <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
      <span />
      <p><strong>{item.actorName} · {activityTitle(item.type)}</strong>{item.productName ?? "Catálogo do cliente"}</p>
      <Glyph name="arrow" />
    </button>)}
    {items.length === 0 && <p className="ws-empty">Ainda não há atividade registrada para este cliente.</p>}
  </div>;
}


function Status({ children = "—" }: { children?: string }) {
  return (
    <span
      className={`ws-status ${children.includes("Aprovado") || children.includes("Completo") ? "is-done" : children.includes("Atenção") || children.includes("Correção") || children.includes("pendência") ? "is-warn" : ""}`}
    >
      {children}
    </span>
  );
}

function RealOverview({ companies, loading, error, go }: { companies: WorkspaceCompany[]; loading: boolean; error: string; go: (v: View) => void }) {
  const products = companies.flatMap((company) => company.products);
  const pending = companies.reduce((count, company) => count + company.pendingCount, 0);
  const review = companies.reduce((count, company) => count + company.inReview, 0);
  const complete = companies.filter((company) => company.totalProducts > 0 && company.completeness === 100).length;
  const activity = companies.flatMap((company) => company.activity.map((event) => ({ ...event, companyName: company.name }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return <>
    <div className="ws-page-title"><div><h1>Visão geral</h1><p>Resumo das empresas e do trabalho registrado no sistema.</p></div><button className="ws-primary" onClick={() => go("add-client")}><Glyph name="plus" /> Adicionar cliente</button></div>
    {error && <p className="ws-empty" role="alert">{error}</p>}
    <div className="ws-layout overview-layout">
      <Card title="Prioridades de hoje" className="ws-card--large">
        <div className="ws-priority"><span><Glyph name="alert" /></span><div><strong>{pending} produtos em solicitações abertas</strong><p>{loading ? "Atualizando informações…" : `${companies.length} clientes vinculados à sua conta.`}</p></div><button onClick={() => go("requests")}>Ver solicitações <Glyph name="arrow" /></button></div>
        <div className="ws-priority"><span><Glyph name="file" /></span><div><strong>{review} solicitações enviadas para revisão</strong><p>Contagem calculada das solicitações persistidas.</p></div><button onClick={() => go("requests")}>Revisar agora <Glyph name="arrow" /></button></div>
      </Card>
      <div className="ws-metrics-panel"><Metric value={loading ? "—" : companies.length} label="Clientes ativos" /><Metric value={loading ? "—" : pending} label="Produtos em solicitações abertas" /><Metric value={loading ? "—" : complete} label="Catálogos completos" /></div>
      <Card title="Atividade recente" className="ws-card--timeline"><div className="ws-timeline">{activity.map((event) => <button key={event.id} onClick={() => go(event.requestId ? "requests" : "activity")}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.createdAt))}</time><span /><p><strong>{event.actorName} · {activityTitle(event.type)}</strong>{event.productName ?? event.companyName}</p><Glyph name="arrow" /></button>)}{!loading && !activity.length && <p className="ws-empty">Ainda não há eventos registrados.</p>}</div></Card>
      <RequestsCard />
    </div>
    <span hidden>{products.length}</span>
  </>;
}

function RealClients({ companies, loading, error, go, onSelect }: { companies: WorkspaceCompany[]; loading: boolean; error: string; go: (v: View) => void; onSelect: (companyId: string) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const filtered = companies.filter((company) => {
    const matchText = `${company.name} ${company.cnpj}`.toLowerCase().includes(search.toLowerCase());
    const label = company.pendingCount ? "Em andamento" : company.inReview ? "Aguardando revisão" : "Sem pendências";
    return matchText && (status === "Todos" || status === label);
  });
  const pendingCompanies = companies.filter((company) => company.pendingCount > 0).length;
  const waitingImporter = companies.reduce((sum, company) => sum + company.awaitingImporter, 0);
  const completed = companies.filter((company) => company.totalProducts > 0 && company.completeness === 100).length;
  return <>
    <div className="ws-page-title"><div><h1>Clientes</h1><p>Empresas vinculadas ao seu acesso e seus catálogos.</p></div><button className="ws-primary" onClick={() => go("add-client")}><Glyph name="plus" /> Adicionar cliente</button></div>
    {error && <p className="ws-empty" role="alert">{error}</p>}
    <div className="ws-metrics-grid"><Metric value={loading ? "—" : companies.length} label="Clientes ativos" /><Metric value={loading ? "—" : pendingCompanies} label="Clientes com pendências" /><Metric value={loading ? "—" : waitingImporter} label="Solicitações aguardando importador" /><Metric value={loading ? "—" : completed} label="Catálogos completos" /></div>
    <Card title="Clientes" className="ws-table-card"><div className="ws-tools"><label><Glyph name="search" /><input placeholder="Buscar empresa ou CNPJ" value={search} onChange={(event) => setSearch(event.target.value)} /></label><Dropdown label="Status" options={["Todos", "Em andamento", "Aguardando revisão", "Sem pendências"]} value={status} onChange={setStatus} /></div>
      <div className="ws-table"><div className="ws-tr ws-th client-cols"><span>Empresa</span><span>CNPJ principal</span><span>Produtos</span><span>Completude</span><span>Pendências</span><span>Próxima ação</span><span>Atualização</span><span>Status</span><span /></div>
        {filtered.map((company) => { const label = company.pendingCount ? "Em andamento" : company.inReview ? "Aguardando revisão" : "Sem pendências"; const last = company.activity[0]?.createdAt; return <button className="ws-tr client-cols" key={company.id} onClick={() => { onSelect(company.id); go("client"); }}><strong>{company.name}</strong><span>{company.cnpj}</span><span>{company.totalProducts} produtos</span><span>{company.completeness}%</span><span>{company.pendingCount}</span><span>{company.pendingCount ? "Importador" : company.inReview ? "Despachante" : "—"}</span><span>{last ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(last)) : "—"}</span><span><Status>{label}</Status></span><Glyph name="arrow" /></button>; })}
        {!loading && filtered.length === 0 && <p className="ws-empty">{companies.length ? "Nenhum cliente corresponde aos filtros." : "Nenhum cliente está vinculado à sua conta. Crie uma solicitação para associar uma empresa."}</p>}
        {loading && <p className="ws-empty">Carregando clientes do banco…</p>}
      </div>
    </Card>
  </>;
}

function RealClientDetail({ company, go }: { company?: WorkspaceCompany; go: (v: View) => void }) {
  if (!company) return <div className="ws-empty">Selecione um cliente para ver os detalhes.</div>;
  return <>
    <Breadcrumb>Clientes / {company.name}</Breadcrumb>
    <div className="ws-page-title client-header"><div><h1>{company.name}</h1><p>{company.cnpj} · Contato: {company.contactName ?? "—"}</p></div><div><button className="ws-primary" onClick={() => go("requests")}>Solicitações</button></div></div>
    <div className="ws-tabs"><button className="active">Visão geral</button><button onClick={() => go("catalog")}>Catálogo</button><button onClick={() => go("requests")}>Solicitações</button><button onClick={() => go("activity")}>Atividade</button></div>
    <div className="ws-layout client-layout"><Card title="Visão geral do cliente" className="ws-card--large"><div className="ws-stat-rows"><Metric value={company.totalProducts} label="Total de produtos" /><Metric value={`${company.completeness}%`} label="Completude geral" /><Metric value={company.pendingCount} label="Produtos em solicitações abertas" /><Metric value={company.inReview} label="Solicitações em revisão" /></div></Card>
      <Card title="Quem precisa agir"><div className="ws-who"><span>IM</span><p><strong>Importador</strong><small>{company.awaitingImporter} solicitações abertas</small></p><button onClick={() => go("requests")}>Ver</button></div><div className="ws-who"><span>DE</span><p><strong>Despachante</strong><small>{company.inReview} aguardando revisão</small></p><button onClick={() => go("requests")}>Ver</button></div></Card>
      <Card title="Catálogo" className="ws-card--wide"><button className="ws-quiet" onClick={() => go("catalog")}>Abrir catálogo · {company.totalProducts} produtos <Glyph name="arrow" /></button></Card>
      <Card title="Atividade recente" className="ws-card--wide"><RealActivityList items={company.activity} go={go} /></Card>
    </div>
  </>;
}

function RealCatalog({ company, go, onSelectProduct }: { company?: WorkspaceCompany; go: (v: View) => void; onSelectProduct: (productId: string) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [ncm, setNcm] = useState("Todas");
  const [completeness, setCompleteness] = useState("Todas");
  if (!company) return <div className="ws-empty">Nenhum cliente vinculado. Crie uma solicitação para associar uma empresa e acessar seu catálogo.</div>;
  const products = (company.products ?? []).map((product) => ({ ...product, attributes: product.attributes ?? [] }));
  const complete = products.filter((product) => product.attributes.every((attribute) => (attribute.value ?? "").trim())).length;
  const submittedProducts = products.filter((product) => product.status === "sent_for_review").length;
  const productFilter = products.filter((product) => (product.name ?? "").toLowerCase().includes(search.toLowerCase()) || (product.sku ?? "").toLowerCase().includes(search.toLowerCase()) || (product.ncm ?? "").includes(search)).filter((product) => status === "Todos" || dispatcherStatusLabel(product) === status).filter((product) => ncm === "Todas" || product.ncm === ncm).filter((product) => completeness === "Todas" || (completeness === "100%" ? productCompleteness(product) === 100 : productCompleteness(product) !== 100));
  const ncmOptions = ["Todas", ...new Set(products.map((product) => product.ncm).filter(Boolean))];
  return <>
    <Breadcrumb>Clientes / {company.name} / {company.cnpj}</Breadcrumb>
    <div className="ws-page-title"><div><h1>{company.name}</h1><p>{company.cnpj} · Catálogo vinculado</p></div><div><button className="ws-primary" onClick={() => go("create-product")}><Glyph name="plus" /> Novo produto</button></div></div>
    <div className="ws-metrics-grid five"><Metric value={company.totalProducts} label="Produtos" /><Metric value={complete} label="Completos" /><Metric value={company.pendingCount} label="Com pendências" /><Metric value={submittedProducts} label="Em revisão" /><Metric value={0} label="Com erro" /></div>
    <Card title="Catálogo de Produtos" className="ws-table-card"><div className="ws-tools"><label><Glyph name="search" /><input placeholder="Buscar produto, código ou NCM" value={search} onChange={(event) => setSearch(event.target.value)} /></label><Dropdown label="Status" options={["Todos", "Aguardando importador", "Aguardando despachante", "Correção solicitada", "Aprovado"]} value={status} onChange={setStatus} /><Dropdown label="NCM" options={ncmOptions} value={ncm} onChange={setNcm} /><Dropdown label="Completude" options={[["Todas", "Todas"], ["100% (Completo)", "100%"], ["< 100% (Incompleto)", "incomplete"]]} value={completeness} onChange={setCompleteness} />
      </div><Table onProduct={(product) => { if (!product) return; onSelectProduct(product.id); go("product"); }} search="" backendProducts={productFilter} /></Card>
  </>;
}

function RealProduct({ product, company, go }: { product?: Product; company?: WorkspaceCompany; go: (v: View) => void }) {
  if (!product || !company) return <div className="ws-empty">Selecione um produto do catálogo para ver seus dados.</div>;
  const filled = product.attributes.filter((attribute) => attribute.value.trim()).length;
  const completeness = product.attributes.length ? Math.round(filled / product.attributes.length * 100) : 0;
  return <>
    <Breadcrumb>Clientes / {company.name} / Catálogo / {product.name}</Breadcrumb>
    <div className="ws-page-title"><div><h1>{product.name}</h1><p>{product.sku} · NCM {product.ncm}</p></div><div><Status>{dispatcherStatusLabel(product)}</Status></div></div>
    <div className="ws-layout"><Card title="Dados do produto" className="ws-card--large"><p className="ws-card-copy">Informações persistidas no catálogo de {company.name}.</p>
      <div className="ws-data-sections">{product.attributes.map((attribute) => <div className="ws-data-section" key={attribute.key}><h3>{attribute.label}</h3><div><span>Valor</span><strong>{attribute.value || "Não informado"}</strong><Status>{attribute.value ? "Preenchido" : "Pendente"}</Status></div></div>)}</div>
    </Card><div><Card title="Completude"><div className="ws-big-number">{completeness}<span>% completo</span></div><p className="ws-card-copy">{filled} de {product.attributes.length} campos preenchidos.</p></Card><Card title="Cliente"><strong>{company.name}</strong><p className="ws-card-copy">{company.cnpj}</p><button className="ws-quiet" onClick={() => go("catalog")}>Voltar ao catálogo</button></Card></div></div>
  </>;
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="ws-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function LiveDataPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="ws-empty-state">
      <div className="ws-page-title"><div><h1>{title}</h1><p>{description}</p></div></div>
      <Card title="Nenhum dado carregado">
        <p className="ws-card-copy">Esta área exibe somente informações persistidas no backend. Assim que houver registros reais para este contexto, eles aparecerão aqui.</p>
      </Card>
    </div>
  );
}
function Card({
  title,
  children,
  className = "",
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`ws-card ${className}`}>
      {title && (
        <header className="ws-card-head">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
function Breadcrumb({ children }: { children: React.ReactNode }) {
  return <div className="ws-breadcrumb">{children}</div>;
}

type PendingFilters = {
  cliente?: string;
  cnpj?: string;
  responsavel?: string;
  tipo?: string;
  status?: string;
};

const pendingRows = [
  {
    pendencia: "Informar composição do material",
    produto: "Motor XP-200",
    cliente: "Atlas Importações",
    cnpj: "12.345.678/0001-90",
    responsavel: "Importador",
    criada: "17/09",
    status: "Aguardando cliente",
    tipo: "Informação",
  },
  {
    pendencia: "Revisar NCM informada",
    produto: "Válvula VX-80",
    cliente: "Ocean Trade",
    cnpj: "32.147.890/0001-12",
    responsavel: "Despachante",
    criada: "16/09",
    status: "Em revisão",
    tipo: "Revisão",
  },
  {
    pendencia: "Anexar ficha técnica",
    produto: "Sensor A12",
    cliente: "Atlas Importações",
    cnpj: "12.345.678/0001-90",
    responsavel: "Importador",
    criada: "15/09",
    status: "Atrasada",
    tipo: "Documento",
  },
  {
    pendencia: "Confirmar país de origem",
    produto: "Válvula VX-80",
    cliente: "Ocean Trade",
    cnpj: "32.147.890/0001-12",
    responsavel: "Importador",
    criada: "12/09",
    status: "Atrasada",
    tipo: "Informação",
  },
];

const timelineEvents = [
  {
    time: "14:10",
    actor: "Carlos aprovou",
    subject: "Motor Elétrico XP-200",
    user: "Carlos",
    type: "Aprovação",
    client: "Atlas Importações",
    order: 4,
  },
  {
    time: "13:42",
    actor: "Mariana atualizou",
    subject: "Material",
    user: "Mariana",
    type: "Atualização",
    client: "Atlas Importações",
    order: 3,
  },
  {
    time: "11:03",
    actor: "Sistema encontrou",
    subject: "3 inconsistências em catalogo_setembro.xlsx",
    user: "Sistema",
    type: "Importação",
    client: "—",
    order: 2,
  },
  {
    time: "Ontem",
    actor: "Carlos enviou lembrete",
    subject: "Atlas Importações",
    user: "Carlos",
    type: "Lembrete",
    client: "Atlas Importações",
    order: 1,
  },
];

function Table({
  onProduct,
  onClient,
  backendProducts,
  pending = false,
  search = "",
  statusFilter = "Todos",
  ncmFilter = "Todas",
  completudeFilter = "Todas",
  pendingFilters,
  companyId,
}: {
  onProduct?: (product?: Product) => void;
  onClient?: () => void;
  backendProducts?: Product[];
  pending?: boolean;
  search?: string;
  statusFilter?: string;
  ncmFilter?: string;
  completudeFilter?: string;
  pendingFilters?: PendingFilters;
  /** Restringe os produtos ao catálogo de uma empresa (isolamento por cliente). */
  companyId?: string;
}) {
  const [menu, setMenu] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { products: storeProducts } = useStoreState();

  const productList = useMemo(
    () => backendProducts ?? (companyId ? productsForCompany(companyId) : storeProducts),
    [backendProducts, storeProducts, companyId],
  );

  const filteredProducts = useMemo(() => {
    return productList.filter((row) => {
      const matchSearch =
        !search ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        row.sku.toLowerCase().includes(search.toLowerCase()) ||
        row.ncm.includes(search);
      const matchStatus =
        statusFilter === "Todos" || dispatcherStatusLabel(row) === statusFilter;
      const matchNcm = ncmFilter === "Todas" || row.ncm === ncmFilter;
      const matchComp =
        completudeFilter === "Todas" ||
        (completudeFilter === "100%"
          ? productCompleteness(row) === 100
          : productCompleteness(row) !== 100);
      return matchSearch && matchStatus && matchNcm && matchComp;
    });
  }, [productList, search, statusFilter, ncmFilter, completudeFilter]);

  const handleDelete = (id: string) => {
    removeProduct(id);
    setMenu(null);
  };

  const handleCopyNcm = (idx: number, ncm: string) => {
    navigator.clipboard?.writeText(ncm);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
    setMenu(null);
  };

  if (pending) {
    const rows = pendingRows.filter((row) => {
      const f = pendingFilters ?? {};
      return (
        (!f.cliente || f.cliente === "Todos" || row.cliente === f.cliente) &&
        (!f.cnpj || f.cnpj === "Todos" || row.cnpj === f.cnpj) &&
        (!f.responsavel ||
          f.responsavel === "Todos" ||
          row.responsavel === f.responsavel) &&
        (!f.tipo || f.tipo === "Todos" || row.tipo === f.tipo) &&
        (!f.status || f.status === "Todos" || row.status === f.status)
      );
    });
    return (
      <div className="ws-table">
        <div className="ws-tr ws-th pending-cols">
          <span>Pendência</span>
          <span>Produto</span>
          <span>Cliente</span>
          <span>Responsável</span>
          <span>Criada em</span>
          <span>Status</span>
        </div>
        {rows.map((row) => (
          <button
            className="ws-tr pending-cols"
            onClick={() => onProduct?.()}
            key={row.pendencia}
          >
            <span>{row.pendencia}</span>
            <span>{row.produto}</span>
            <span>{row.cliente}</span>
            <span>{row.responsavel}</span>
            <span>{row.criada}</span>
            <span>
              <Status>{row.status}</Status>
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="ws-empty">
            Nenhuma pendência corresponde aos filtros selecionados.
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      {menu !== null && (
        <div className="ws-menu-backdrop" onClick={() => setMenu(null)} />
      )}
      <div className="ws-table">
        <div className="ws-tr ws-th product-cols">
          <span>Produto</span>
          <span>Código</span>
          <span>NCM</span>
          <span>Completude</span>
          <span>Status</span>
          <span>Responsável</span>
          <span>Atualizado</span>
          <span />
        </div>
        {filteredProducts.map((row, idx) => (
          <div className="ws-row-wrap" key={row.id}>
            <div
              className="ws-tr product-cols"
              onClick={() => onProduct?.(row)}
              role="button"
              tabIndex={0}
            >
              <strong>{row.name}</strong>
              <span>{row.sku}</span>
              <span>{row.ncm}</span>
              <span>
                <i className="ws-bar">
                  <b style={{ width: `${productCompleteness(row)}%` }} />
                </i>
                {productCompleteness(row)}%
              </span>
              <span>
                <Status>{dispatcherStatusLabel(row)}</Status>
              </span>
              <span>
                {row.status === "sent_for_review"
                  ? "Despachante"
                  : row.status === "approved"
                    ? "—"
                    : "Importador"}
              </span>
              <span>{row.updatedAt}</span>
              <span
                className="ws-more-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(menu === idx ? null : idx);
                }}
                aria-label="Opções do produto"
              >
                <Glyph name="more" size={17} />
              </span>
            </div>
            <AnimatePresence>
              {menu === idx && (
                <motion.div
                  className="ws-row-menu"
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(null);
                      onProduct?.();
                    }}
                  >
                    Abrir produto
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(null);
                      onProduct?.();
                    }}
                  >
                    Revisar dados
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyNcm(idx, row.ncm);
                    }}
                  >
                    {copiedIndex === idx
                      ? "✓ Copiado!"
                      : `Copiar NCM (${row.ncm})`}
                  </button>
                  <button
                    className="is-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row.id);
                    }}
                  >
                    Excluir do catálogo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <p className="ws-empty">
            Nenhum produto corresponde aos filtros selecionados.
          </p>
        )}
      </div>
    </>
  );
}

function AppTop({
  go,
  onSearch,
  onNotify,
  onLogout,
  unread = 0,
}: {
  go: (v: View) => void;
  onSearch: () => void;
  onNotify: () => void;
  onLogout: () => void;
  unread?: number;
}) {
  return (
    <header className="ws-top">
      <button className="ws-brand" onClick={() => go("overview")}>
        <span>P</span>PRISMA
      </button>
      <div className="ws-utilities">
        <ThemeToggle className="ws-utility-theme" />
        <SoundToggle />
        <button aria-label="Buscar" onClick={onSearch}>
          <Glyph name="search" />
        </button>
        <button
          className={unread > 0 ? "ws-bell has-unread" : "ws-bell"}
          aria-label={`Notificações (${unread} não lidas)`}
          onClick={onNotify}
        >
          <span className="ws-bell-icon" key={unread}>
            <Glyph name="bell" />
          </span>
          {unread > 0 && <i />}
        </button>
        <button
          className="ws-profile"
          aria-label="Abrir configurações da conta"
          onClick={() => go("settings")}
        >
          <span>CM</span>
          <b>Carlos Mendes</b>
        </button>
        <button className="ws-logout" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}
const nav: [View, GlyphName, string][] = [
  ["overview", "home", "Visão geral"],
  ["clients", "people", "Clientes"],
  ["catalog", "boxes", "Catálogos"],
  ["requests", "file", "Solicitações"],
  ["pending", "alert", "Pendências"],
  ["import", "download", "Importar"],
  ["assistant", "robot", "Assistente"],
  ["activity", "pulse", "Atividade"],
  ["settings", "settings", "Configurações"],
];
function Rail({
  active,
  go,
  openChat,
}: {
  active: View;
  go: (v: View) => void;
  openChat: () => void;
}) {
  return (
    <aside className="ws-rail" aria-label="Navegação rápida">
      {nav.map(([id, icon, label]) => (
        <div className="ws-rail-item" key={id}>
          <button
            title={label}
            className={active === id ? "active" : ""}
            onClick={() => (id === "assistant" ? openChat() : go(id))}
            aria-label={label}
          >
            <Glyph name={icon} />
          </button>
          {id === "assistant" && (
            <button
              className="ws-rail-full"
              title="Assistente completo"
              aria-label="Abrir assistente completo"
              onClick={() => go("assistant")}
            >
              <Glyph name="spark" />
            </button>
          )}
        </div>
      ))}
    </aside>
  );
}

function Overview({ go }: { go: (v: View) => void }) {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Visão geral</h1>
          <p>O que precisa da sua atenção hoje.</p>
        </div>
        <button className="ws-primary" onClick={() => go("add-client")}>
          <Glyph name="plus" /> Adicionar cliente
        </button>
      </div>
      <div className="ws-layout overview-layout">
        <Card title="Prioridades de hoje" className="ws-card--large">
          <div className="ws-priority">
            <span>
              <Glyph name="alert" />
            </span>
            <div>
              <strong>18 produtos aguardam informações</strong>
              <p>Atlas Importações concentra 11 das pendências abertas.</p>
            </div>
            <button onClick={() => go("pending")}>
              Ver pendências <Glyph name="arrow" />
            </button>
          </div>
          <div className="ws-priority">
            <span>
              <Glyph name="file" />
            </span>
            <div>
              <strong>7 produtos prontos para revisão</strong>
              <p>A documentação está completa e aguarda ação do despachante.</p>
            </div>
            <button onClick={() => go("review")}>
              Revisar agora <Glyph name="arrow" />
            </button>
          </div>
        </Card>
        <div className="ws-metrics-panel">
          <Metric value="23" label="Clientes ativos" />
          <Metric value="74" label="Pendências" />
          <Metric value="14" label="Catálogos completos" />
        </div>
        <Card title="Atividade recente" className="ws-card--timeline">
          <Timeline go={go} />
        </Card>
        <RequestsCard />
      </div>
    </>
  );
}
function Clients({ go }: { go: (v: View) => void }) {
  const [menu, setMenu] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [responsavelFilter, setResponsavelFilter] = useState("Todos");

  const filteredClients = useMemo(() => {
    return clients.filter((r) => {
      const matchSearch =
        !search ||
        r[0].toLowerCase().includes(search.toLowerCase()) ||
        r[1].includes(search);
      const matchStatus = statusFilter === "Todos" || r[7] === statusFilter;
      const matchResp =
        responsavelFilter === "Todos" || r[5] === responsavelFilter;
      return matchSearch && matchStatus && matchResp;
    });
  }, [search, statusFilter, responsavelFilter]);

  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Clientes</h1>
          <p>Gerencie importadores e acompanhe seus catálogos.</p>
        </div>
        <button className="ws-primary" onClick={() => go("add-client")}>
          <Glyph name="plus" /> Adicionar cliente
        </button>
      </div>
      <div className="ws-metrics-grid">
        <Metric value="23" label="Clientes ativos" />
        <Metric value="9" label="Clientes com pendências" />
        <Metric value="6" label="Aguardando importador" />
        <Metric value="14" label="Catálogos completos" />
      </div>
      {menu !== null && (
        <div className="ws-menu-backdrop" onClick={() => setMenu(null)} />
      )}
      <Card
        title="Clientes"
        className="ws-table-card"
        action={
          <button className="ws-quiet">
            <Glyph name="upload" /> Exportar
          </button>
        }
      >
        <div className="ws-tools">
          <label>
            <Glyph name="search" />
            <input
              placeholder="Buscar empresa ou CNPJ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Dropdown
            label="Status"
            options={[
              "Todos",
              "Em andamento",
              "Atenção necessária",
              "Completo",
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filtrar por Status"
          />
          <Dropdown
            label="Responsável"
            options={["Todos", "Importador", "Despachante"]}
            value={responsavelFilter}
            onChange={setResponsavelFilter}
            ariaLabel="Filtrar por Responsável"
          />
        </div>
        <div className="ws-table">
          <div className="ws-tr ws-th client-cols">
            <span>Empresa</span>
            <span>CNPJ principal</span>
            <span>Produtos</span>
            <span>Completude</span>
            <span>Pendências</span>
            <span>Próxima ação</span>
            <span>Atualização</span>
            <span>Status</span>
            <span />
          </div>
          {filteredClients.map((r, i) => (
            <div className="ws-row-wrap" key={r[0]}>
              <button
                className="ws-tr client-cols"
                onClick={() => go("client")}
              >
                <strong>{r[0]}</strong>
                <span>{r[1]}</span>
                <span>{r[2]}</span>
                <span>{r[3]}</span>
                <span>{r[4]}</span>
                <span>{r[5]}</span>
                <span>{r[6]}</span>
                <span>
                  <Status>{r[7]}</Status>
                </span>
                <span
                  className="ws-more-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === i ? null : i);
                  }}
                >
                  <Glyph name="more" size={17} />
                </span>
              </button>
              <AnimatePresence>
                {menu === i && (
                  <motion.div
                    className="ws-row-menu"
                    initial={{ opacity: 0, scale: 0.94, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button
                      onClick={() => {
                        setMenu(null);
                        go("client");
                      }}
                    >
                      Abrir cliente
                    </button>
                    <button
                      onClick={() => {
                        setMenu(null);
                        go("catalog");
                      }}
                    >
                      Abrir catálogo
                    </button>
                    <button
                      onClick={() => {
                        setMenu(null);
                        go("pending");
                      }}
                    >
                      Ver pendências
                    </button>
                    <button onClick={() => setMenu(null)}>
                      Convidar usuário
                    </button>
                    <button onClick={() => setMenu(null)}>
                      Editar cliente
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function ClientDetail({ go }: { go: (v: View) => void }) {
  return (
    <>
      <Breadcrumb>Clientes / Atlas Importações</Breadcrumb>
      <div className="ws-page-title client-header">
        <div>
          <h1>Atlas Importações</h1>
          <p>12.345.678/0001-90 · Responsável: Mariana Souza</p>
        </div>
        <div>
          <button className="ws-quiet">Convidar usuário</button>
          <button className="ws-quiet">Adicionar CNPJ</button>
          <button className="ws-icon">
            <Glyph name="more" />
          </button>
        </div>
      </div>
      <div className="ws-tabs">
        <button className="active">Visão geral</button>
        <button onClick={() => go("catalog")}>Catálogo</button>
        <button onClick={() => go("pending")}>Pendências</button>
        <button onClick={() => go("users")}>Usuários</button>
        <button onClick={() => go("activity")}>Atividade</button>
      </div>
      <div className="ws-layout client-layout">
        <Card title="Visão geral do cliente" className="ws-card--large">
          <div className="ws-stat-rows">
            <Metric value="182" label="Total de produtos" />
            <Metric value="94%" label="Completude geral" />
            <Metric value="11" label="Pendências" />
            <Metric value="7" label="Em revisão" />
          </div>
        </Card>
        <Card title="Quem precisa agir">
          <div className="ws-who">
            <span>IM</span>
            <p>
              <strong>Importador</strong>
              <small>7 pendências</small>
            </p>
            <button onClick={() => go("pending")}>Ver</button>
          </div>
          <div className="ws-who">
            <span>DE</span>
            <p>
              <strong>Despachante</strong>
              <small>4 pendências</small>
            </p>
            <button onClick={() => go("pending")}>Ver</button>
          </div>
        </Card>
        <Card title="CNPJs" className="ws-card--wide">
          <button className="ws-cnpj" onClick={() => go("catalog")}>
            <div>
              <strong>Matriz</strong>
              <span>12.345.678/0001-90</span>
            </div>
            <span>152 produtos</span>
            <span>96% completo</span>
            <Status>8 pendências</Status>
            <Glyph name="arrow" />
          </button>
          <button className="ws-cnpj" onClick={() => go("catalog")}>
            <div>
              <strong>Filial Santos</strong>
              <span>12.345.678/0002-70</span>
            </div>
            <span>30 produtos</span>
            <span>87% completo</span>
            <Status>3 pendências</Status>
            <Glyph name="arrow" />
          </button>
        </Card>
        <Card title="Atividade recente" className="ws-card--wide">
          <Timeline go={go} />
        </Card>
        <RequestsCard />
      </div>
    </>
  );
}
function RequestsPage() {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Solicitações</h1>
          <p>Links de preenchimento enviados aos importadores.</p>
        </div>
      </div>
      <div className="ws-layout">
        <RequestsCard />
      </div>
    </>
  );
}

function formatRequestDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function requestInputDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

function RequestsCard() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<(CatalogRequest & { url?: string }) | null>(null);
  const [recipientName, setRecipientName] = useState("Mariana Costa");
  const [recipientEmail, setRecipientEmail] = useState("mariana@atlas.com.br");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"fill" | "correction">("fill");
  const [allIncomplete, setAllIncomplete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(["p-motor", "p-valvula"]);
  const [correctionProductId, setCorrectionProductId] = useState("p-valvula");
  const [correctionFieldKey, setCorrectionFieldKey] = useState("material");
  const [correctionNote, setCorrectionNote] = useState(
    "Especifique o tipo de aço utilizado.",
  );
  const [backendCompanies, setBackendCompanies] = useState<BackendCompany[]>([]);
  const [selectedRequestCompanyId, setSelectedRequestCompanyId] = useState("");
  const [backendRequests, setBackendRequests] = useState<any[]>([]);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [actionState, setActionState] = useState<{ id: string; kind: "link" | "cancel" | "delete" } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [reviewRequest, setReviewRequest] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const activeCompany = backendCompanies.find((company) => company.id === selectedRequestCompanyId) ?? backendCompanies[0];
  useEffect(() => {
    listCatalogCompanies().then((companies) => {
      setBackendCompanies(companies);
      if (companies[0]) {
        setSelectedRequestCompanyId(companies[0].id);
        setRecipientName(companies[0].contactName ?? "");
        setRecipientEmail(companies[0].contactEmail ?? "");
        const firstProduct = companies[0].products[0];
        setCorrectionProductId(firstProduct?.id ?? "");
        setCorrectionFieldKey(firstProduct?.attributes[0]?.key ?? "");
        setSelectedIds(companies[0].products.slice(0, 2).map((product) => product.id));
      }
    }).catch((error) => setBackendError(error.message));
  }, []);
  useEffect(() => {
    if (activeCompany) {
      listCompanyCatalogRequests(activeCompany.id)
        .then((items) => setBackendRequests(items))
        .catch((error) => setBackendError(error.message));
    }
  }, [activeCompany]);
  const { requests, products } = useStoreState();
  const atlasRequests = backendCompanies.length ? backendRequests : [];
  const atlasProducts = activeCompany?.products ?? [];
  const completenessOf = (product: any) => {
    const persisted = Number.parseInt(String(product.completeness ?? ""), 10);
    return Number.isFinite(persisted) ? persisted : productCompleteness(product);
  };

  const RequestStatus = ({ status }: { status: CatalogRequest["status"] }) => (
    <span
      className={`ws-status ${status === "completed" ? "is-done" : ["expired", "cancelled"].includes(status) ? "is-warn" : ""}`}
    >
      {requestStatusLabel(status)}
    </span>
  );

  const close = () => {
    setOpen(false);
    setCreated(null);
    setEditingRequest(null);
  };

  const openNewRequest = () => {
    setEditingRequest(null);
    setCreated(null);
    setOpen(true);
  };

  const openEditRequest = (request: any) => {
    setEditingRequest(request);
    setCreated(null);
    setRecipientName(request.recipientName);
    setRecipientEmail(request.recipientEmail);
    setDeadline(requestInputDate(request.expiresAt));
    setMessage(request.message ?? "");
    setKind(request.kind);
    setSelectedIds(request.productIds ?? []);
    setAllIncomplete(false);
    setOpen(true);
  };

  const generate = async () => {
    const incompleteIds = atlasProducts
      .filter((p) => completenessOf(p) < 100)
      .map((p) => p.id);
    const productIds =
      kind === "correction"
        ? [correctionProductId]
        : allIncomplete
          ? incompleteIds
          : selectedIds;
    if (!activeCompany) { setBackendError("Nenhuma empresa disponível no backend."); return; }
    try {
    if (editingRequest) {
      const updated = await updateBackendCatalogRequest(editingRequest.id, {
        recipientName,
        recipientEmail,
        expiresAt: new Date(`${deadline}T23:59:59`).toISOString(),
        message: message || null,
        ...(editingRequest.kind === "fill" && editingRequest.status === "waiting" ? { productIds } : {}),
      });
      setBackendRequests((items) => items.map((item) => item.id === editingRequest.id ? { ...item, ...updated, productIds: productIds } : item));
      showToast("Solicitação atualizada");
      playUISound("save");
      close();
      return;
    }
    const request = await createBackendCatalogRequest({
      companyId: activeCompany.id,
      recipientName,
      recipientEmail,
      productIds,
      expiresAt: new Date(`${deadline}T23:59:59`).toISOString(),
      message: message || undefined,
      kind,
      correctionFieldKey: kind === "correction" ? correctionFieldKey : undefined,
      correctionNote: kind === "correction" ? correctionNote : undefined,
    });
    const frontendUrl = `${window.location.origin}/r/${request.token}/catalogo`;
    const requestWithUrl = { ...request, url: frontendUrl, productIds };
    setCreated(requestWithUrl);
    setBackendRequests((items) => [{ ...requestWithUrl, productCount: productIds.length }, ...items]);
    } catch (error) { setBackendError(error instanceof Error ? error.message : "Não foi possível criar a solicitação."); }
  };

  const sendLink = async (request: any) => {
    setActionState({ id: request.id, kind: "link" });
    try {
      const fresh = await reissueCatalogRequest(request.id);
      const link = `${window.location.origin}/r/${fresh.token}/catalogo`;
      await navigator.clipboard?.writeText(link);
      setBackendRequests((items) => items.map((item) => item.id === request.id ? { ...item, token: fresh.token, url: link } : item));
      setCopiedRequestId(request.id);
      showToast("Link copiado — pronto para enviar ao importador.");
      playUISound("success");
      window.setTimeout(() => setCopiedRequestId((current) => current === request.id ? null : current), 2400);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    } finally {
      setActionState(null);
    }
  };

  const cancelRequest = async (request: any) => {
    setActionState({ id: request.id, kind: "cancel" });
    try {
      const cancelled = await cancelBackendCatalogRequest(request.id);
      setBackendRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: cancelled.status } : item));
      setCancelTarget(null);
      showToast("Solicitação cancelada. O link não está mais ativo.");
      playUISound("warning");
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Não foi possível cancelar a solicitação.");
    } finally {
      setActionState(null);
    }
  };

  const deleteRequest = async (request: any) => {
    setActionState({ id: request.id, kind: "delete" });
    try {
      await deleteBackendCatalogRequest(request.id);
      setBackendRequests((items) => items.filter((item) => item.id !== request.id));
      setDeleteTarget(null);
      showToast("Solicitação excluída definitivamente.");
      playUISound("warning");
    } catch (error: any) {
      showToast(error?.message ?? "Não foi possível excluir a solicitação.");
      playUISound("error");
    } finally {
      setActionState(null);
    }
  };

  const approveRequest = async (request: any) => {
    setActionState({ id: request.id, kind: "link" });
    try {
      const approved = await approveBackendCatalogRequest(request.id);
      setBackendRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: approved.status } : item));
      showToast("Informações aprovadas e aplicadas ao catálogo.");
      playUISound("success");
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Não foi possível aprovar a solicitação.");
    } finally { setActionState(null); }
  };

  const openReview = async (request: any) => {
    try { setRejectNote(""); setReviewRequest(await getCatalogRequestReview(request.id)); } catch (error) { setBackendError(error instanceof Error ? error.message : "Não foi possível carregar as respostas."); }
  };

  const rejectRequest = async () => {
    if (!reviewRequest) return;
    setActionState({ id: reviewRequest.id, kind: "cancel" });
    try {
      const rejected = await rejectBackendCatalogRequest(reviewRequest.id, rejectNote);
      setBackendRequests((items) => items.map((item) => item.id === reviewRequest.id ? { ...item, status: rejected.status } : item));
      setReviewRequest(null);
      showToast("Correção solicitada ao importador.");
      playUISound("warning");
    } catch (error) { setBackendError(error instanceof Error ? error.message : "Não foi possível recusar a solicitação."); }
    finally { setActionState(null); }
  };

  return (
    <>
      <Card
        title="Solicitações de preenchimento"
        className="ws-card--wide"
        action={
          <button className="ws-quiet" onClick={openNewRequest}>
            <Glyph name="plus" /> Solicitar informações
          </button>
        }
      >
        {backendError && (
          <p className="ws-card-copy" style={{ color: "#b42318" }}>
            {backendError}. Verifique se o backend está rodando em localhost:3000.
          </p>
        )}
        {atlasRequests.length === 0 && (
          <p className="ws-card-copy">
            Nenhuma solicitação criada para esta empresa.
          </p>
        )}
        {atlasRequests.map((request) => (
          <div className="ws-request" key={request.id}>
            <div>
              <strong>#{request.id}</strong>
              <span>
                {request.productIds.length} produto
                {request.productIds.length > 1 ? "s" : ""} · {request.recipientName}{" "}
                · vence {formatRequestDate(request.expiresAt)}
              </span>
              <p>{request.recipientEmail}</p>
            </div>
            <RequestStatus status={request.status} />
            <div className="ws-request-actions">
              <button
                className="ws-quiet"
                onClick={() => openEditRequest(request)}
                disabled={Boolean(actionState) || ["submitted", "completed", "expired", "cancelled"].includes(request.status)}
              >
                Editar
              </button>
              <button
                className={copiedRequestId === request.id ? "ws-primary" : "ws-quiet"}
                onClick={() => sendLink(request)}
                disabled={Boolean(actionState) || ["expired", "cancelled"].includes(request.status)}
              >
                {actionState?.id === request.id && actionState?.kind === "link" ? "Gerando..." : copiedRequestId === request.id ? "Link copiado" : "Enviar link"}
              </button>
              <button
                className="ws-danger"
                onClick={() => setCancelTarget(request)}
                disabled={Boolean(actionState) || ["submitted", "completed", "expired", "cancelled"].includes(request.status)}
              >
                {actionState?.id === request.id && actionState?.kind === "cancel" ? "Cancelando..." : "Cancelar"}
              </button>
              <button
                className="ws-danger ws-danger--quiet"
                title="Excluir definitivamente"
                onClick={() => setDeleteTarget(request)}
                disabled={Boolean(actionState)}
              >
                {actionState?.id === request.id && actionState?.kind === "delete" ? "Excluindo..." : "Excluir"}
              </button>
              {request.status === "submitted" && <><button className="ws-quiet" onClick={() => void openReview(request)} disabled={Boolean(actionState)}>Ver respostas</button><button className="ws-primary" onClick={() => void approveRequest(request)} disabled={Boolean(actionState)}>{actionState?.id === request.id ? "Aprovando..." : "Aprovar"}</button></>}
            </div>
          </div>
        ))}
      </Card>
      <Modal
        open={open}
        onClose={close}
        title={created ? "Solicitação criada" : editingRequest ? "Editar solicitação" : "Solicitar informações"}
        wide={Boolean(created)}
      >
        {!created ? (
          <>
            <p className="ws-card-copy" style={{ marginBottom: 16 }}>
              {editingRequest
                ? "Atualize o destinatário, o prazo ou os produtos antes de reenviar o link."
                : "Gere um link único para o importador preencher somente os produtos incluídos nesta solicitação."}
            </p>
            {!editingRequest && <div className="ws-segmented-row">
              <button
                className={kind === "fill" ? "active" : ""}
                onClick={() => setKind("fill")}
              >
                Preencher informações
              </button>
              <button
                className={kind === "correction" ? "active" : ""}
                onClick={() => setKind("correction")}
              >
                Corrigir informação
              </button>
            </div>}
            <label className="ws-field">
              <span>Empresa</span>
              {backendCompanies.length > 1 && <select aria-label="Selecionar empresa" value={activeCompany?.id ?? ""} onChange={(event) => { const company = backendCompanies.find((item) => item.id === event.target.value); if (!company) return; setSelectedRequestCompanyId(company.id); setRecipientName(company.contactName ?? ""); setRecipientEmail(company.contactEmail ?? ""); setSelectedIds(company.products.slice(0, 2).map((product) => product.id)); setCorrectionProductId(company.products[0]?.id ?? ""); setCorrectionFieldKey(company.products[0]?.attributes[0]?.key ?? ""); }}>{backendCompanies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.cnpj}</option>)}</select>}
              <input value={activeCompany ? `${activeCompany.name} · ${activeCompany.cnpj}` : "Carregando empresa..."} readOnly />
            </label>
            <label className="ws-field">
              <span>Responsável</span>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </label>
            <label className="ws-field">
              <span>E-mail</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </label>
            {kind === "fill" ? (
              <>
                <label className="ws-field">
                  <span>Produtos solicitados</span>
                  <div className="ws-check-list">
                    <label>
                      <input
                        type="checkbox"
                        checked={allIncomplete}
                        disabled={Boolean(editingRequest && editingRequest.status !== "waiting")}
                        onChange={(e) => setAllIncomplete(e.target.checked)}
                      />
                      Todos os produtos incompletos
                    </label>
                    {atlasProducts.map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          disabled={allIncomplete || Boolean(editingRequest && editingRequest.status !== "waiting")}
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) =>
                            setSelectedIds((ids) =>
                              e.target.checked
                                ? [...ids, p.id]
                                : ids.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <span>
                          {p.name} <small>· {completenessOf(p)}%</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </label>
                {editingRequest?.status !== "waiting" && (
                  <p className="ws-card-copy">Os produtos não podem ser alterados depois que o preenchimento começou.</p>
                )}
              </>
            ) : editingRequest ? (
              <p className="ws-card-copy">O produto e a observação desta correção permanecem protegidos; você ainda pode atualizar o destinatário, a mensagem e o prazo.</p>
            ) : (
              <>
                <label className="ws-field">
                  <span>Produto</span>
                  <Dropdown
                    options={atlasProducts.map((product) => [product.name, product.id] as const)}
                    value={correctionProductId}
                    onChange={(productId) => {
                      const selectedProduct = atlasProducts.find((product) => product.id === productId);
                      setCorrectionProductId(productId);
                      setCorrectionFieldKey(selectedProduct?.attributes[0]?.key ?? "");
                    }}
                    ariaLabel="Selecionar produto para correção"
                  />
                </label>
                <label className="ws-field">
                  <span>Campo</span>
                  <Dropdown
                    options={(
                      atlasProducts.find((product) => product.id === correctionProductId)
                        ?.attributes ?? []
                    ).map((attribute) => [attribute.label, attribute.key] as const)}
                    value={correctionFieldKey}
                    onChange={setCorrectionFieldKey}
                    ariaLabel="Selecionar campo para correção"
                  />
                </label>
                <label className="ws-field">
                  <span>Observação</span>
                  <textarea
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder="Descreva a correção necessária"
                  />
                </label>
              </>
            )}
            <label className="ws-field">
              <span>Prazo</span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <label className="ws-field">
              <span>Mensagem opcional</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex.: Precisamos destas informações antes do embarque."
              />
            </label>
            <div className="ws-modal-actions">
              <button className="ws-quiet" onClick={close}>
                Cancelar
              </button>
              <button
                className="ws-primary"
                onClick={generate}
                disabled={
                  kind === "correction"
                    ? !correctionProductId
                    : !allIncomplete && selectedIds.length === 0
                }
              >
                {editingRequest ? "Salvar alterações" : "Gerar solicitação"}
              </button>
            </div>
          </>
        ) : (
          <div className="ws-request-created">
            <span className="ws-request-check">
              <Glyph name="check" size={22} />
            </span>
            <h3>Convite enviado para {created.recipientEmail}</h3>
            <p className="ws-card-copy">
              O importador poderá preencher somente os produtos desta
              solicitação.
            </p>
            <div className="ws-request-link">
              {created.url ?? `${window.location.origin}/r/${created.token}/catalogo`}
            </div>
            <div className="ws-request-meta">
              <div>
                <span>Destinatário</span>
                <strong>{created.recipientName}</strong>
              </div>
              <div>
                <span>Prazo</span>
                <strong>{formatRequestDate(created.expiresAt)}</strong>
              </div>
              <div>
                <span>Produtos</span>
                <strong>{created.productIds.length}</strong>
              </div>
              <div>
                <span>Status</span>
                <RequestStatus status={created.status} />
              </div>
            </div>
            <div className="ws-modal-actions">
              <button
                className="ws-quiet"
                onClick={() => {
                  const link = created.url ?? `${window.location.origin}/r/${created.token}/catalogo`;
                  navigator.clipboard?.writeText(link);
                  showToast("Link copiado");
                  playUISound("success");
                }}
              >
                Copiar link
              </button>
              <button
                className="ws-quiet"
                onClick={() => {
                  showToast(
                    `Convite enviado para ${created.recipientEmail} — simulação`,
                  );
                  playUISound("success");
                }}
              >
                Enviar por e-mail
              </button>
              <button
                className="ws-primary"
                onClick={() => navigate(`/r/${created.token}/catalogo`)}
              >
                Abrir link
              </button>
            </div>
            <button
              className="ws-link"
              style={{ marginTop: 14 }}
              onClick={() => {
                // Atalho de demonstração: entra como o importador da empresa.
                login("u-mariana");
                navigate("/app");
              }}
            >
              Abrir como importador (demonstração)
            </button>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(reviewRequest)} onClose={() => setReviewRequest(null)} title="Revisar respostas do importador" wide>
        <p className="ws-card-copy">Confira os valores enviados antes de aplicar ao catálogo oficial.</p>
        {reviewRequest?.products?.map((product: any) => <Card key={product.id} title={product.name}><div className="ws-data-sections">{product.attributes.map((attribute: any) => <div className="ws-data-section" key={attribute.key}><h3>{attribute.label}</h3><div><strong>{attribute.value || "Não informado"}</strong><Status>{attribute.value ? "Respondido" : "Pendente"}</Status></div></div>)}</div></Card>)}
        <label className="ws-field"><span>Motivo da recusa (obrigatório apenas se recusar)</span><textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Explique o que precisa ser corrigido pelo importador." /></label>
        <div className="ws-form-actions"><button className="ws-danger ws-danger--solid" disabled={!rejectNote.trim() || Boolean(actionState)} onClick={() => void rejectRequest()}>Recusar e solicitar correção</button><button className="ws-primary" disabled={Boolean(actionState)} onClick={() => { if (reviewRequest) void approveRequest(reviewRequest); setReviewRequest(null); }}>Aprovar e aplicar ao catálogo</button></div>
      </Modal>
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => !actionState && setCancelTarget(null)}
        title="Cancelar solicitação"
      >
        <div className="ws-cancel-request">
          <p>O link enviado para <strong>{cancelTarget?.recipientName}</strong> deixará de aceitar preenchimentos imediatamente.</p>
          <p className="ws-card-copy">Essa ação não apaga os dados já salvos, mas encerra esta solicitação.</p>
          <div className="ws-modal-actions">
            <button className="ws-quiet" disabled={Boolean(actionState)} onClick={() => setCancelTarget(null)}>Voltar</button>
            <button className="ws-danger ws-danger--solid" disabled={Boolean(actionState)} onClick={() => cancelTarget && void cancelRequest(cancelTarget)}>
              {actionState?.kind === "cancel" ? "Cancelando..." : "Confirmar cancelamento"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !actionState && setDeleteTarget(null)}
        title="Excluir solicitação"
      >
        <div className="ws-cancel-request">
          <p>Excluir a solicitação enviada para <strong>{deleteTarget?.recipientName}</strong>?</p>
          <p className="ws-card-copy">Esta ação remove a solicitação, os dados respondidos e o link de acesso. Ela não pode ser desfeita.</p>
          <div className="ws-modal-actions">
            <button className="ws-quiet" disabled={Boolean(actionState)} onClick={() => setDeleteTarget(null)}>Voltar</button>
            <button className="ws-danger ws-danger--solid" disabled={Boolean(actionState)} onClick={() => deleteTarget && void deleteRequest(deleteTarget)}>
              {actionState?.kind === "delete" ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
function Catalog({ go }: { go: (v: View) => void }) {
  const [selected, setSelected] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [ncmFilter, setNcmFilter] = useState("Todas");
  const [completudeFilter, setCompletudeFilter] = useState("Todas");

  return (
    <>
      <Breadcrumb>Clientes / Atlas Importações / 12.345.678/0001-90</Breadcrumb>
      <div className="ws-page-title">
        <div>
          <h1>Atlas Importações — Matriz</h1>
          <p>12.345.678/0001-90 · Catálogo em andamento</p>
        </div>
        <div>
          <button className="ws-quiet" onClick={() => go("import")}>
            Importar planilha
          </button>
          <button className="ws-primary" onClick={() => go("create-product")}>
            <Glyph name="plus" /> Novo produto
          </button>
        </div>
      </div>
      <div className="ws-metrics-grid five">
        <Metric value="182" label="Produtos" />
        <Metric value="153" label="Completos" />
        <Metric value="18" label="Com pendências" />
        <Metric value="7" label="Em revisão" />
        <Metric value="4" label="Com erro" />
      </div>
      <Card
        title="Catálogo de Produtos"
        className="ws-table-card"
        action={<button className="ws-quiet">Exportar</button>}
      >
        <div className="ws-tools">
          <label>
            <Glyph name="search" />
            <input
              placeholder="Buscar produto, código ou NCM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Dropdown
            label="Status"
            options={[
              "Todos",
              "Aguardando importador",
              "Aguardando despachante",
              "Correção solicitada",
              "Aprovado",
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filtrar por Status"
          />
          <Dropdown
            label="NCM"
            options={[
              "Todas",
              "8501.10.19",
              "9031.80.99",
              "8481.80.99",
              "8413.70.90",
              "8537.10.90",
            ]}
            value={ncmFilter}
            onChange={setNcmFilter}
            ariaLabel="Filtrar por NCM"
          />
          <Dropdown
            label="Completude"
            options={[
              ["Todas", "Todas"],
              ["100% (Completo)", "100%"],
              ["< 100% (Incompleto)", "incomplete"],
            ]}
            value={completudeFilter}
            onChange={setCompletudeFilter}
            ariaLabel="Filtrar por Completude"
          />
        </div>
        {selected && (
          <div className="ws-bulk">
            <span>3 produtos selecionados</span>
            <button>Solicitar revisão</button>
            <button>Exportar selecionados</button>
            <button onClick={() => setSelected(false)}>
              <Glyph name="close" />
            </button>
          </div>
        )}
        <label className="ws-select-all">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => setSelected(e.target.checked)}
          />{" "}
          Selecionar produtos
        </label>
        <Table
          onProduct={() => go("product")}
          search={search}
          statusFilter={statusFilter}
          ncmFilter={ncmFilter}
          completudeFilter={completudeFilter}
          companyId="atlas"
        />
      </Card>
    </>
  );
}
function Product({
  go,
  review = false,
}: {
  go: (v: View) => void;
  review?: boolean;
}) {
  const [correction, setCorrection] = useState(false);
  const [askCorrection, setAskCorrection] = useState(false);
  const [corrField, setCorrField] = useState("material");
  const [corrNote, setCorrNote] = useState("");
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldRequired, setFieldRequired] = useState(true);
  const [fieldNote, setFieldNote] = useState("");
  const { products: storeProducts } = useStoreState();
  const motorProduct = storeProducts.find((p) => p.id === "p-motor");
  const correctionFields =
    motorProduct?.attributes.map((a) => ({ key: a.key, label: a.label })) ?? [];
  const customFields = motorProduct ? customFieldsOf(motorProduct) : [];
  const closeAskCorrection = () => {
    setAskCorrection(false);
    setCorrNote("");
  };
  const closeAddField = () => {
    setAddFieldOpen(false);
    setFieldLabel("");
    setFieldNote("");
    setFieldRequired(true);
  };
  if (review)
    return (
      <>
        <Breadcrumb>Catálogo / Motor Elétrico XP-200 / Revisão</Breadcrumb>
        <div className="ws-page-title">
          <div>
            <h1>Revisão do produto</h1>
            <p>Motor Elétrico XP-200 · NCM 8501.10.19</p>
          </div>
          <Status>Aguardando revisão</Status>
        </div>
        <div className="ws-layout review-layout">
          <Card title="Informações do produto" className="ws-card--large">
            <ReviewRow
              label="Material"
              value="Alumínio"
              correction={correction}
              setCorrection={setCorrection}
            />
            <ReviewRow
              label="Potência"
              value="—"
              correction={correction}
              setCorrection={setCorrection}
              required
            />
            <ReviewRow
              label="Aplicação"
              value="Equipamento industrial"
              correction={correction}
              setCorrection={setCorrection}
            />
            <div className="ws-form-actions">
              <button
                className="ws-quiet"
                onClick={() => showToast("Correções enviadas ao importador")}
              >
                Enviar correções ao importador
              </button>
              <button
                className="ws-primary"
                onClick={() => {
                  approveProduct("p-motor");
                  showToast("Produto aprovado");
                  go("catalog");
                }}
              >
                Aprovar produto
              </button>
            </div>
          </Card>
          <div>
            <Card title="Progresso da revisão">
              <div className="ws-big-number">
                16 <span>/ 19 campos</span>
              </div>
              <p className="ws-card-copy">
                16 aprovados · 3 precisam de correção
              </p>
            </Card>
            <Card title="Correções solicitadas">
              <ul className="ws-list">
                <li>
                  Potência <Status>Obrigatório</Status>
                </li>
                <li>
                  Composição <Status>Aguardando cliente</Status>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </>
    );
  return (
    <>
      <Breadcrumb>Catálogo / Motor Elétrico XP-200</Breadcrumb>
      <div className="ws-page-title">
        <div>
          <h1>Motor Elétrico XP-200</h1>
          <p>MTR-0021 · NCM 8501.10.19 · 92% completo</p>
        </div>
        <div>
          <button className="ws-quiet" onClick={() => go("create-product")}>
            Editar
          </button>
          <button className="ws-quiet" onClick={() => setAskCorrection(true)}>
            Solicitar correção
          </button>
          <button
            className="ws-primary"
            onClick={() => {
              approveProduct("p-motor");
              showToast("Produto aprovado");
              go("catalog");
            }}
          >
            Aprovar
          </button>
        </div>
      </div>
      <Modal
        open={askCorrection}
        onClose={closeAskCorrection}
        title="Solicitar correção"
      >
        <p className="ws-card-copy" style={{ marginBottom: 14 }}>
          Aponte o campo e descreva o ajuste necessário. O importador receberá a
          solicitação no portal.
        </p>
        <label className="ws-field">
          <span>Campo</span>
          <Dropdown
            options={correctionFields.map((field) => [field.label, field.key] as const)}
            value={corrField}
            onChange={setCorrField}
            ariaLabel="Selecionar campo para correção"
          />
        </label>
        <label className="ws-field">
          <span>Observação</span>
          <textarea
            value={corrNote}
            onChange={(e) => setCorrNote(e.target.value)}
            placeholder="Descreva a correção necessária"
          />
        </label>
        <div className="ws-modal-actions">
          <button className="ws-quiet" onClick={closeAskCorrection}>
            Cancelar
          </button>
          <button
            className="ws-primary"
            onClick={() => {
              requestCorrection(
                "p-motor",
                corrField,
                corrNote || "Complete as informações deste campo.",
              );
              closeAskCorrection();
              showToast("Correção solicitada ao importador");
            }}
          >
            Solicitar correção
          </button>
        </div>
      </Modal>
      <div className="ws-tabs">
        <button className="active">Dados</button>
        <button onClick={() => go("pending")}>Pendências</button>
        <button>Comentários</button>
        <button>Histórico</button>
      </div>
      <div className="ws-layout product-layout">
        <Card title="Dados do produto" className="ws-card--large">
          <DataSection
            title="Identificação"
            fields={[
              ["Nome comercial", "Motor Elétrico XP-200", "Validado"],
              ["Código interno", "MTR-0021", "Validado"],
              ["Marca", "Volter", "Validado"],
            ]}
          />
          <DataSection
            title="Classificação"
            fields={[
              ["NCM", "8501.10.19", "Validado"],
              [
                "Descrição",
                "Motores elétricos de potência inferior a 37,5 W",
                "Validado",
              ],
            ]}
          />
          <DataSection
            title="Atributos específicos da NCM"
            fields={[
              ["Material", "Alumínio", "Validado"],
              ["Potência", "—", "Obrigatório"],
              ["Tensão", "220V", "Validado"],
              ["Aplicação", "—", "Obrigatório"],
            ]}
          />
        </Card>
        <div>
          <Card title="Completude">
            <div className="ws-big-number">92%</div>
            <i className="ws-progress">
              <b style={{ width: "92%" }} />
            </i>
          </Card>
          <Card title="Status da revisão">
            <strong>16 de 19 campos validados</strong>
            <p className="ws-card-copy">Aguardando ação do despachante.</p>
          </Card>
          <Card title="Responsável atual">
            <div className="ws-person">
              <span>CM</span>
              <div>
                <strong>Despachante</strong>
                <small>Carlos Mendes</small>
              </div>
            </div>
          </Card>
        </div>
        <Card
          title="Informações solicitadas ao importador"
          action={
            <button className="ws-quiet" onClick={() => setAddFieldOpen(true)}>
              <Glyph name="plus" /> Adicionar campo
            </button>
          }
        >
          <p className="ws-card-copy" style={{ marginBottom: 10 }}>
            Campos personalizados que o importador precisa preencher neste
            produto.
          </p>
          {customFields.length === 0 && (
            <p className="ws-card-copy">Nenhum campo personalizado.</p>
          )}
          {customFields.map((field) => (
            <div className="ws-custom-field" key={field.key}>
              <div>
                <strong>
                  {field.label}
                  {field.required ? " *" : ""}
                </strong>
                {field.note && <p>{field.note}</p>}
              </div>
              <Status>{field.required ? "Obrigatório" : "Opcional"}</Status>
              <button
                className="ws-icon"
                aria-label={`Remover campo ${field.label}`}
                onClick={() => {
                  removeCustomField("p-motor", field.key);
                  showToast("Campo removido");
                }}
              >
                <Glyph name="close" size={14} />
              </button>
            </div>
          ))}
        </Card>
      </div>
      <Modal
        open={addFieldOpen}
        onClose={closeAddField}
        title="Adicionar campo personalizado"
      >
        <p className="ws-card-copy" style={{ marginBottom: 16 }}>
          O campo será exibido no portal do importador, com a instrução abaixo,
          e passará a contar na completude do produto.
        </p>
        <label className="ws-field">
          <span>Nome do campo</span>
          <input
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Ex.: Número de série do fabricante"
          />
        </label>
        <label className="ws-switch" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={fieldRequired}
            onChange={(e) => setFieldRequired(e.target.checked)}
          />{" "}
          Campo obrigatório
        </label>
        <label className="ws-field">
          <span>Instrução para o importador (opcional)</span>
          <textarea
            value={fieldNote}
            onChange={(e) => setFieldNote(e.target.value)}
            placeholder="Ex.: informe o número gravado na placa de identificação."
          />
        </label>
        <div className="ws-modal-actions">
          <button className="ws-quiet" onClick={closeAddField}>
            Cancelar
          </button>
          <button
            className="ws-primary"
            disabled={!fieldLabel.trim()}
            onClick={() => {
              addCustomField("p-motor", {
                label: fieldLabel,
                required: fieldRequired,
                note: fieldNote,
              });
              closeAddField();
              showToast("Campo adicionado e solicitado ao importador");
            }}
          >
            Adicionar campo
          </button>
        </div>
      </Modal>
    </>
  );
}
function ReviewRow({
  label,
  value,
  required,
  correction,
  setCorrection,
}: {
  label: string;
  value: string;
  required?: boolean;
  correction: boolean;
  setCorrection: (v: boolean) => void;
}) {
  return (
    <div className="ws-review-row">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <Status>{required ? "Obrigatório" : "Validado"}</Status>
      <div>
        <button className="ws-mini">Aprovar</button>
        <button className="ws-mini" onClick={() => setCorrection(!correction)}>
          Solicitar correção
        </button>
      </div>
      {correction && (
        <textarea
          placeholder="Descreva a correção necessária"
          defaultValue={
            label === "Material"
              ? "Informe também a composição percentual."
              : ""
          }
        />
      )}
    </div>
  );
}
function DataSection({ title, fields }: { title: string; fields: string[][] }) {
  return (
    <div className="ws-data-section">
      <h3>{title}</h3>
      {fields.map((f) => (
        <div key={f[0]}>
          <span>{f[0]}</span>
          <strong>{f[1]}</strong>
          <Status>{f[2]}</Status>
        </div>
      ))}
    </div>
  );
}
function Pending({
  go,
  detail = false,
}: {
  go: (v: View) => void;
  detail?: boolean;
}) {
  const [clientFilter, setClientFilter] = useState("Todos");
  const [cnpjFilter, setCnpjFilter] = useState("Todos");
  const [responsavelFilter, setResponsavelFilter] = useState("Todos");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  if (detail)
    return (
      <>
        <Breadcrumb>Pendências / Motor XP-200 / Material</Breadcrumb>
        <div className="ws-page-title">
          <div>
            <h1>Informar composição do material</h1>
            <p>Motor XP-200 · Atlas Importações</p>
          </div>
          <Status>Aguardando importador</Status>
        </div>
        <div className="ws-layout pending-detail-layout">
          <Card title="Pendência" className="ws-card--large">
            <div className="ws-detail-grid">
              <span>Produto</span>
              <strong>Motor XP-200</strong>
              <span>Cliente</span>
              <strong>Atlas Importações</strong>
              <span>Campo</span>
              <strong>Material</strong>
              <span>Valor atual</span>
              <strong>Alumínio</strong>
              <span>Alteração solicitada</span>
              <strong>Informe a composição percentual.</strong>
              <span>Responsável</span>
              <strong>Importador</strong>
            </div>
            <textarea placeholder="Adicionar comentário" />
            <div className="ws-form-actions">
              <button className="ws-quiet">Enviar lembrete</button>
              <button className="ws-primary">Encerrar pendência</button>
            </div>
          </Card>
          <Card title="Histórico">
            <Timeline go={go} />
          </Card>
        </div>
      </>
    );
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Pendências</h1>
          <p>Tudo que ainda precisa de ação.</p>
        </div>
      </div>
      <div className="ws-metrics-grid five">
        <Metric value="74" label="Todas" />
        <Metric value="31" label="Aguardando importador" />
        <Metric value="18" label="Aguardando despachante" />
        <Metric value="9" label="Erros de validação" />
        <Metric value="16" label="Atrasadas" />
      </div>
      <Card title="Pendências" className="ws-table-card">
        <div className="ws-tools">
          <Dropdown
            label="Cliente"
            options={["Todos", "Atlas Importações", "Ocean Trade"]}
            value={clientFilter}
            onChange={setClientFilter}
            hideAllLabel
            ariaLabel="Filtrar por Cliente"
          />
          <Dropdown
            label="CNPJ"
            options={["Todos", "12.345.678/0001-90", "32.147.890/0001-12"]}
            value={cnpjFilter}
            onChange={setCnpjFilter}
            hideAllLabel
            ariaLabel="Filtrar por CNPJ"
          />
          <Dropdown
            label="Responsável"
            options={["Todos", "Importador", "Despachante"]}
            value={responsavelFilter}
            onChange={setResponsavelFilter}
            hideAllLabel
            ariaLabel="Filtrar por Responsável"
          />
          <Dropdown
            label="Tipo"
            options={["Todos", "Informação", "Revisão", "Documento"]}
            value={tipoFilter}
            onChange={setTipoFilter}
            hideAllLabel
            ariaLabel="Filtrar por Tipo"
          />
          <Dropdown
            label="Status"
            options={["Todos", "Aguardando cliente", "Em revisão", "Atrasada"]}
            value={statusFilter}
            onChange={setStatusFilter}
            hideAllLabel
            ariaLabel="Filtrar por Status"
          />
        </div>
        <Table
          pending
          onProduct={() => go("pending-detail")}
          pendingFilters={{
            cliente: clientFilter,
            cnpj: cnpjFilter,
            responsavel: responsavelFilter,
            tipo: tipoFilter,
            status: statusFilter,
          }}
        />
      </Card>
    </>
  );
}
const prismaFieldOptions = [
  "Nome do produto",
  "Código interno / SKU",
  "NCM (Classificação Fiscal)",
  "Descrição comercial",
  "Fabricante / Marca",
  "País de origem",
  "Peso líquido (kg)",
  "Peso bruto (kg)",
  "Valor unitário (USD)",
  "Unidade de medida",
  "— Ignorar esta coluna —",
];

const initialMappingRows = [
  {
    col: "Produto",
    sample: "Motor Elétrico XP-200",
    defaultMap: "Nome do produto",
  },
  {
    col: "NCM",
    sample: "8501.10.19",
    defaultMap: "NCM (Classificação Fiscal)",
  },
  {
    col: "Descrição",
    sample: "Motores elétricos de potência inferior...",
    defaultMap: "Descrição comercial",
  },
  {
    col: "Código / SKU",
    sample: "MTR-0021",
    defaultMap: "Código interno / SKU",
  },
  {
    col: "Fabricante",
    sample: "Volter Tech",
    defaultMap: "Fabricante / Marca",
  },
  { col: "Peso Líquido", sample: "4,50 kg", defaultMap: "Peso líquido (kg)" },
];

function Import({
  go,
  result = false,
}: {
  go: (v: View) => void;
  result?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({
    Produto: "Nome do produto",
    NCM: "NCM (Classificação Fiscal)",
    Descrição: "Descrição comercial",
    "Código / SKU": "Código interno / SKU",
    Fabricante: "Fabricante / Marca",
    "Peso Líquido": "Peso líquido (kg)",
  });

  const handleMappingChange = (col: string, val: string) => {
    setColumnMappings((prev) => ({ ...prev, [col]: val }));
  };
  if (result)
    return (
      <>
        <div className="ws-page-title">
          <div>
            <h1>Importação concluída</h1>
          </div>
        </div>
        <Card className="ws-success">
          <span>
            <Glyph name="check" size={26} />
          </span>
          <h2>742 registros processados.</h2>
          <p>
            A importação foi concluída. Alguns itens ainda precisam de revisão.
          </p>
          <div>
            <button className="ws-primary" onClick={() => go("catalog")}>
              Ver catálogo
            </button>
            <button className="ws-quiet" onClick={() => go("pending")}>
              Revisar inconsistências
            </button>
          </div>
        </Card>
        <div className="ws-metrics-grid">
          <Metric value="104" label="Produtos atualizados" />
          <Metric value="13" label="Adicionados" />
          <Metric value="7" label="Precisam de revisão" />
          <Metric value="3" label="Possuem erro" />
        </div>
        <Card title="Última importação">
          <div className="ws-detail-grid">
            <span>Arquivo</span>
            <strong>catalogo_setembro.xlsx</strong>
            <span>Data</span>
            <strong>19 set, 14:32</strong>
            <span>Usuário</span>
            <strong>Carlos Mendes</strong>
            <span>Tempo de processamento</span>
            <strong>18 segundos</strong>
          </div>
        </Card>
      </>
    );
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Importar catálogo</h1>
          <p>Traga produtos de uma planilha e valide antes de confirmar.</p>
        </div>
      </div>
      <div className="ws-steps">
        {["Arquivo", "Mapeamento", "Validação", "Confirmar"].map((v, i) => (
          <button
            className={step === i + 1 ? "active" : ""}
            onClick={() => setStep(i + 1)}
            key={v}
          >
            <b>{i + 1}</b>
            {v}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -7 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 1 && (
            <Card className="ws-upload">
              <Glyph name="upload" size={34} />
              <h2>Arraste sua planilha aqui</h2>
              <p>Formatos aceitos: XLSX, XLS e CSV</p>
              <button className="ws-primary" onClick={() => setStep(2)}>
                Selecionar arquivo
              </button>
              <button className="ws-link">Baixar modelo</button>
            </Card>
          )}
          {step === 2 && (
            <Card title="Mapeamento de colunas">
              <p className="ws-card-copy" style={{ marginBottom: "18px" }}>
                Associe as colunas detectadas no arquivo{" "}
                <strong>catalogo_setembro.xlsx</strong> aos campos cadastrais do
                PRISMA.
              </p>
              <div className="ws-map">
                <div className="ws-map-th">Coluna da planilha</div>
                <div className="ws-map-th">Exemplo na planilha</div>
                <div className="ws-map-th">Campo no PRISMA</div>
                {initialMappingRows.map((row) => (
                  <div className="ws-map-tr" key={row.col}>
                    <div className="ws-map-col">
                      <strong>{row.col}</strong>
                    </div>
                    <div className="ws-map-sample">
                      <code>{row.sample}</code>
                    </div>
                    <div className="ws-map-select-wrap">
                      <Dropdown
                        options={prismaFieldOptions}
                        value={columnMappings[row.col] || row.defaultMap}
                        onChange={(v) => handleMappingChange(row.col, v)}
                        ariaLabel={`Mapeamento para coluna ${row.col}`}
                        triggerClass="ws-map-select"
                        menuClass="ws-menu--scroll"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="ws-map-footer">
                <button className="ws-quiet" onClick={() => setStep(1)}>
                  Voltar
                </button>
                <button className="ws-primary" onClick={() => setStep(3)}>
                  Continuar para validação <Glyph name="arrow" />
                </button>
              </div>
            </Card>
          )}
          {step === 3 && (
            <>
              <div className="ws-metrics-grid">
                <Metric value="742" label="Registros" />
                <Metric value="601" label="Válidos" />
                <Metric value="102" label="Incompletos" />
                <Metric value="39" label="Com erro" />
              </div>
              <Card title="Validação">
                <Table pending onProduct={() => {}} />
                <button className="ws-primary" onClick={() => setStep(4)}>
                  Confirmar dados
                </button>
              </Card>
            </>
          )}
          {step === 4 && (
            <Card className="ws-confirm-card">
              <div className="ws-confirm-head">
                <h2>Confirmar importação</h2>
                <p>
                  Revise o resumo da operação antes de atualizar o catálogo.
                </p>
              </div>
              <div className="ws-confirm-grid">
                <div className="ws-confirm-item">
                  <span>Produtos novos</span>
                  <strong>13</strong>
                </div>
                <div className="ws-confirm-item">
                  <span>Produtos atualizados</span>
                  <strong>104</strong>
                </div>
                <div className="ws-confirm-item">
                  <span>Produtos ignorados</span>
                  <strong>3</strong>
                </div>
                <div className="ws-confirm-item">
                  <span>Produtos com erro</span>
                  <strong>3</strong>
                </div>
              </div>
              <div className="ws-confirm-actions">
                <button className="ws-quiet" onClick={() => setStep(3)}>
                  Voltar
                </button>
                <button
                  className="ws-primary"
                  onClick={() => go("import-result")}
                >
                  Confirmar importação <Glyph name="arrow" />
                </button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
function Activity({ go }: { go: (v: View) => void }) {
  const [clientFilter, setClientFilter] = useState("Todos");
  const [userFilter, setUserFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [orderFilter, setOrderFilter] = useState("Mais recentes");
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Atividade</h1>
          <p>Um registro cronológico de mudanças no catálogo.</p>
        </div>
      </div>
      <Card title="Atividade" className="ws-card--large">
        <div className="ws-tools">
          <Dropdown
            label="Cliente"
            options={["Todos", "Atlas Importações", "Ocean Trade"]}
            value={clientFilter}
            onChange={setClientFilter}
            hideAllLabel
            ariaLabel="Filtrar por Cliente"
          />
          <Dropdown
            label="Usuário"
            options={["Todos", "Carlos", "Mariana", "Sistema"]}
            value={userFilter}
            onChange={setUserFilter}
            hideAllLabel
            ariaLabel="Filtrar por Usuário"
          />
          <Dropdown
            label="Tipo"
            options={[
              "Todos",
              "Aprovação",
              "Atualização",
              "Importação",
              "Lembrete",
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            hideAllLabel
            ariaLabel="Filtrar por Tipo"
          />
          <Dropdown
            label="Data"
            options={["Mais recentes", "Mais antigas"]}
            value={orderFilter}
            onChange={setOrderFilter}
            ariaLabel="Ordenar por Data"
          />
        </div>
        <Timeline
          go={go}
          filters={{
            client: clientFilter,
            user: userFilter,
            type: typeFilter,
            order: orderFilter,
          }}
        />
      </Card>
    </>
  );
}
function Users() {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Usuários e acessos</h1>
          <p>Controle quem pode trabalhar em cada cliente e CNPJ.</p>
        </div>
        <button className="ws-primary">
          <Glyph name="plus" /> Convidar usuário
        </button>
      </div>
      <div className="ws-metrics-grid">
        <Metric value="18" label="Usuários ativos" />
        <Metric value="3" label="Convites pendentes" />
        <Metric value="4" label="Administradores" />
        <Metric value="11" label="Importadores" />
      </div>
      <Card title="Usuários" className="ws-table-card">
        <div className="ws-table">
          <div className="ws-tr ws-th users-cols">
            <span>Usuário</span>
            <span>E-mail</span>
            <span>Perfil</span>
            <span>Empresa</span>
            <span>CNPJ</span>
            <span>Último acesso</span>
            <span>Status</span>
            <span />
          </div>
          {[
            [
              "Carlos Mendes",
              "carlos@prisma.com",
              "Despachante",
              "Atlas Importações",
              "Matriz",
              "Hoje",
              "Ativo",
            ],
            [
              "Mariana Souza",
              "mariana@atlas.com",
              "Importador",
              "Atlas Importações",
              "Matriz",
              "Ontem",
              "Ativo",
            ],
            [
              "Luiz Teixeira",
              "luiz@ocean.com",
              "Visualizador",
              "Ocean Trade",
              "Matriz",
              "12 set",
              "Convite pendente",
            ],
          ].map((r) => (
            <div className="ws-tr users-cols" key={r[1]}>
              {r.map((v, i) => (
                <span key={v}>{i === 6 ? <Status>{v}</Status> : v}</span>
              ))}
              <button className="ws-more-btn" aria-label={`Opções de ${r[0]}`}>
                <Glyph name="more" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function Settings() {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Configurações</h1>
          <p>Preferências, acessos e estados da plataforma.</p>
        </div>
      </div>
      <div className="ws-layout settings-layout">
        <Card title="Configurações">
          <nav className="ws-settings-nav">
            {[
              "Minha conta",
              "Empresa",
              "Equipe",
              "Notificações",
              "Importação e exportação",
              "Integrações",
              "Segurança",
            ].map((x, i) => (
              <button className={i === 0 ? "active" : ""} key={x}>
                {x}
                <Glyph name="arrow" />
              </button>
            ))}
          </nav>
        </Card>
        <div>
          <Card title="Integrações">
            <Integration name="LOGCOMEX" state="Não configurado" />
            <Integration name="SISCOMEX" state="Não configurado" />
          </Card>
          <Card title="Observação">
            <p className="ws-card-copy">
              Estados de interface demonstrativos. Nenhuma integração está ativa
              neste protótipo.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
function Integration({ name, state }: { name: string; state: string }) {
  return (
    <div className="ws-integration">
      <div>
        <strong>{name}</strong>
        <span>Status: {state}</span>
      </div>
      <button className="ws-mini">Configurar</button>
    </div>
  );
}
function Assistant({ go }: { go: (v: View) => void }) {
  const [prompt, setPrompt] = useState(
    "Quais produtos da Atlas Importações estão incompletos?",
  );
  const [context, setContext] = useState("Todos os clientes");
  const [conversations, setConversations] = useState([
    "Atlas — produtos incompletos",
    "Pendências desta semana",
    "Importação setembro",
    "Revisões pendentes",
  ]);
  const messages = useMemo(
    () =>
      context === "Ocean Trade"
        ? {
            answer:
              "A Ocean Trade tem 17 pendências abertas, concentradas em 9 produtos. A maioria aguarda informação do importador.",
            items: [
              "Válvula VX-80 · 78% · 3 campos pendentes",
              "4 produtos aguardam ficha técnica",
            ],
            action: "Ver todos",
          }
        : context === "Brava Equipamentos"
          ? {
              answer:
                "O catálogo da Brava Equipamentos está 100% completo. Não há pendências abertas neste momento.",
              items: ["48 produtos · 100% · 0 pendências"],
              action: "Ver catálogo",
            }
          : prompt.includes("Motor")
            ? {
                answer:
                  "O produto está 78% completo. Ainda faltam três campos obrigatórios: Material, Potência e Aplicação.",
                items: ["Material", "Potência", "Aplicação"],
                action: "Abrir produto",
              }
            : prompt.includes("planilha")
              ? {
                  answer:
                    "A última importação encontrou 10 registros que precisam de atenção.",
                  items: [
                    "3 NCMs inválidas",
                    "4 produtos sem atributos obrigatórios",
                    "2 códigos duplicados",
                    "1 produto sem descrição",
                  ],
                  action: "Ver inconsistências",
                }
              : {
                  answer:
                    "Encontrei 18 produtos incompletos no CNPJ 12.345.678/0001-90. 11 aguardam informações do importador, 4 possuem erros de validação e 3 estão aguardando revisão.",
                  items: [
                    "Motor XP-200 · 78% · 3 campos pendentes",
                    "Sensor Industrial A12 · 82% · 2 campos pendentes",
                  ],
                  action: "Ver todos",
                },
    [prompt, context],
  );
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Assistente PRISMA</h1>
          <p>Converse sobre clientes, produtos, catálogos ou pendências.</p>
        </div>
      </div>
      <div className="ws-chat-layout">
        <Card className="ws-chat-card">
          <div className="ws-context">
            <span>Contexto:</span>
            <Dropdown
              options={[
                "Todos os clientes",
                "Atlas Importações",
                "Ocean Trade",
                "Brava Equipamentos",
              ]}
              value={context}
              onChange={setContext}
              ariaLabel="Selecionar contexto do assistente"
              triggerClass="ws-context-trigger"
              chevronSize={12}
            />
          </div>
          <div className="ws-chat-log">
            <motion.div
              key={`${prompt}-${context}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "grid", gap: 16 }}
            >
              <div className="ws-user-message">{prompt}</div>
              <div className="ws-ai-message">
                <span>
                  <Glyph name="robot" />
                </span>
                <div>
                  <p>{messages.answer}</p>
                  <div className="ws-inline-results">
                    {messages.items.map((x) => (
                      <button key={x}>
                        {x}
                        <Glyph name="arrow" />
                      </button>
                    ))}
                  </div>
                  <button
                    className="ws-link"
                    onClick={() =>
                      go(
                        messages.action === "Abrir produto"
                          ? "product"
                          : messages.action === "Ver catálogo"
                            ? "catalog"
                            : "pending",
                      )
                    }
                  >
                    {messages.action}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          <form
            className="ws-chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              const message = new FormData(event.currentTarget)
                .get("message")
                ?.toString()
                .trim();
              if (message) setPrompt(message);
            }}
          >
            <button type="button" aria-label="Anexar arquivo">
              <Glyph name="plus" />
            </button>
            <input
              name="message"
              placeholder="Pergunte sobre clientes, produtos, catálogos ou pendências…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value)
                  setPrompt(e.currentTarget.value);
              }}
            />
            <button type="submit" aria-label="Enviar">
              <Glyph name="arrow" />
            </button>
          </form>
          <div className="ws-suggest">
            <button
              onClick={() => setPrompt("Quais clientes precisam de atenção?")}
            >
              Quais clientes precisam de atenção?
            </button>
            <button onClick={() => setPrompt("O que falta no Motor XP-200?")}>
              O que falta no Motor XP-200?
            </button>
            <button
              onClick={() => setPrompt("O que deu errado na última planilha?")}
            >
              Analise a última importação
            </button>
          </div>
        </Card>
        <Card
          title="Conversas"
          className="ws-chat-history"
          action={
            <button
              className="ws-quiet ws-chat-new"
              onClick={() => {
                setConversations((c) => ["Nova conversa", ...c]);
                setContext("Todos os clientes");
                setPrompt(
                  "Quais produtos da Atlas Importações estão incompletos?",
                );
              }}
            >
              <Glyph name="plus" size={13} /> Nova conversa
            </button>
          }
        >
          {conversations.map((x) => (
            <button key={x} onClick={() => setPrompt(x)}>
              {x}
              <Glyph name="arrow" />
            </button>
          ))}
        </Card>
      </div>
    </>
  );
}
function FormPage({
  go,
  type,
  onClientCreated,
}: {
  go: (v: View) => void;
  type: "client" | "product";
  onClientCreated?: (company: WorkspaceCompany) => void;
}) {
  const [success, setSuccess] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [accessEmail, setAccessEmail] = useState("mariana@atlas.com.br");
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState("");
  const isProduct = type === "product";

  if (success) {
    return (
      <>
        <Card className="ws-success">
          <span>
            <Glyph name="check" size={26} />
          </span>
          <h2>
            {isProduct
              ? "Produto salvo com sucesso."
              : "Cliente criado com sucesso."}
          </h2>
          <p>{isProduct ? "As informações do produto foram salvas." : "Cliente criado no banco. O envio de convite ainda não está configurado."}</p>
          <div>
            <button
              className="ws-primary"
              onClick={() => go(isProduct ? "product" : "client")}
            >
              {isProduct ? "Abrir produto" : "Abrir cliente"}
            </button>
          </div>
        </Card>
        {!isProduct && false && (
          <Card title="Acesso do importador">
            <div className="ws-access">
              <div className="ws-access-row">
                <span>Status:</span>
                <Status>
                  {inviteSent ? "Convite enviado" : "Convite pendente"}
                </Status>
              </div>
              <p className="ws-card-copy">
                {inviteSent
                  ? `Convite enviado para ${accessEmail}. O importador poderá acessar o portal com este e-mail.`
                  : "O acesso do importador será liberado após o envio do convite, associado ao CNPJ desta empresa."}
              </p>
              <div className="ws-access-actions">
                <button
                  className="ws-primary"
                  disabled={inviteSent}
                  onClick={() => {
                    setInviteSent(true);
                    // Simulação: em produção, dispararia e-mail transacional.
                    showToast(`Convite enviado para ${accessEmail} — simulação`);
                    playUISound("success");
                  }}
                >
                  {inviteSent ? "Convite enviado" : "Enviar convite"}
                </button>
                <button
                  className="ws-quiet"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      "https://prisma.com/convidar/atlas",
                    );
                    showToast("Link de acesso copiado");
                    playUISound("success");
                  }}
                >
                  Copiar link de acesso
                </button>
              </div>
            </div>
          </Card>
        )}
      </>
    );
  }

  if (!isProduct) {
    return (
      <div className="ws-form-container">
        <Breadcrumb>Clientes / Novo cliente</Breadcrumb>
        <div className="ws-page-title">
          <div>
            <h1>Novo cliente</h1>
            <p>Crie a empresa e dê acesso ao importador.</p>
          </div>
        </div>
        <div className="ws-form-stack">
          <FormCard
            title="Empresa"
            fields={["Razão social", "Nome fantasia", "CNPJ"]}
            values={form}
            onChange={(field, value) =>
              setForm((f) => ({ ...f, [field]: value }))
            }
          />
          <FormCard
            title="Responsável"
            fields={["Nome", "E-mail", "Telefone"]}
            values={form}
            onChange={(field, value) =>
              setForm((f) => ({ ...f, [field]: value }))
            }
          />
          <Card title="Acesso à plataforma">
            <label className="ws-switch">
              <input type="checkbox" defaultChecked /> Enviar convite ao
              importador
            </label>
            <p className="ws-card-copy" style={{ marginTop: "8px" }}>
              O convite será enviado para o e-mail informado com permissões
              básicas de edição.
            </p>
          </Card>
          {clientError && <p className="ws-empty" role="alert">{clientError}</p>}
          <div className="ws-form-actions">
            <button className="ws-quiet" onClick={() => go("clients")}>
              Cancelar
            </button>
            <button
              className="ws-primary"
              disabled={clientSaving}
              onClick={async () => {
                const valueFor = (prefix: string) => Object.entries(form).find(([label]) => label.toLowerCase().startsWith(prefix))?.[1]?.trim() ?? "";
                const enterprise = valueFor("raz");
                const cnpj = valueFor("cnpj");
                const name = Object.entries(form).find(([label]) => label.toLowerCase() === "nome")?.[1]?.trim() ?? "";
                const email = valueFor("e-mail").toLowerCase();
                if (!enterprise || !cnpj || !name || !email) { setClientError("Preencha razão social, CNPJ, nome e e-mail do responsável."); return; }
                setClientError("");
                setClientSaving(true);
                try {
                  const company = await createWorkspaceCompany({ enterprise, cnpj, name, email });
                  onClientCreated?.(company);
                  setAccessEmail(email);
                  setSuccess(true);
                  playUISound("success");
                } catch (cause) {
                  setClientError(cause instanceof Error ? cause.message : "Não foi possível criar o cliente.");
                } finally { setClientSaving(false); }
                return;
                // Armazena a empresa no mock associando companyId, CNPJ e e-mail.
                addCompany({
                  name: form["Razão social"] || "Nova Importadora Ltda.",
                  cnpj: form["CNPJ"] || "00.000.000/0001-00",
                  contactName: form["Nome"] || "Responsável",
                  contactEmail: form["E-mail"] || accessEmail,
                });
                setAccessEmail(form["E-mail"] || accessEmail);
                setSuccess(true);
                playUISound("success");
              }}
            >
              {clientSaving ? "Criando..." : "Criar cliente"} <Glyph name="arrow" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb>Catálogo / Novo produto</Breadcrumb>
      <div className="ws-page-title">
        <div>
          <h1>Novo produto</h1>
          <p>Estruture o produto e complete os atributos da classificação.</p>
        </div>
      </div>
      <div className="ws-layout form-layout">
        <div>
          <FormCard
            title="Identificação"
            fields={[
              "Código interno",
              "Nome comercial",
              "Descrição comercial",
              "Marca",
              "Modelo",
            ]}
          />
          <FormCard title="Classificação" fields={["NCM"]} />
          <Card title="Atributos do produto">
            <p className="ws-card-copy" style={{ marginBottom: "16px" }}>
              NCM identificada. Os atributos necessários serão definidos a
              partir desta classificação.
            </p>
            <FormCard
              fields={[
                "Material *",
                "Composição *",
                "Potência *",
                "Tensão *",
                "Aplicação *",
                "Fabricante",
                "País de origem",
              ]}
            />
          </Card>
          <div className="ws-form-actions" style={{ marginTop: "20px" }}>
            <button className="ws-quiet" onClick={() => go("catalog")}>
              Cancelar
            </button>
            <button className="ws-quiet" onClick={() => setSuccess(true)}>
              Salvar rascunho
            </button>
            <button className="ws-primary" onClick={() => setSuccess(true)}>
              Enviar para revisão <Glyph name="arrow" />
            </button>
          </div>
        </div>
        <div>
          <Card title="Completude">
            <div className="ws-big-number">72%</div>
            <p className="ws-card-copy" style={{ marginTop: "12px" }}>
              12 campos preenchidos
              <br />4 obrigatórios pendentes
              <br />2 opcionais pendentes
            </p>
          </Card>
          <Card title="Próximo passo">
            <p className="ws-card-copy">
              Complete os campos obrigatórios antes de enviar para revisão.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
function FormCard({
  title,
  fields,
  values,
  onChange,
}: {
  title?: string;
  fields: string[];
  values?: Record<string, string>;
  onChange?: (field: string, value: string) => void;
}) {
  return (
    <Card title={title}>
      <div className="ws-form-fields">
        {fields.map((x) => (
          <label key={x}>
            <span>{x}</span>
            <input
              value={values ? (values[x] ?? "") : undefined}
              onChange={
                onChange
                  ? (e) => onChange(x, e.target.value)
                  : undefined
              }
              placeholder={`Adicionar ${x.replace(" *", "").toLowerCase()}`}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
function Timeline({
  go,
  filters,
}: {
  go: (v: View) => void;
  filters?: {
    client?: string;
    user?: string;
    type?: string;
    order?: string;
  };
}) {
  const events = useMemo(() => {
    let list = timelineEvents;
    if (filters) {
      if (filters.client && filters.client !== "Todos") {
        list = list.filter((e) => e.client === filters.client);
      }
      if (filters.user && filters.user !== "Todos") {
        list = list.filter((e) => e.user === filters.user);
      }
      if (filters.type && filters.type !== "Todos") {
        list = list.filter((e) => e.type === filters.type);
      }
      list = [...list].sort((a, b) =>
        filters.order === "Mais antigas"
          ? a.order - b.order
          : b.order - a.order,
      );
    }
    return list;
  }, [filters]);
  return (
    <div className="ws-timeline">
      {events.map((x) => (
        <button
          onClick={() =>
            go(x.subject.includes("Motor") ? "product" : "activity")
          }
          key={x.time + x.actor}
        >
          <time>{x.time}</time>
          <span />
          <p>
            <strong>{x.actor}</strong>
            {x.subject}
          </p>
          <Glyph name="arrow" />
        </button>
      ))}
      {events.length === 0 && (
        <p className="ws-empty">
          Nenhuma atividade corresponde aos filtros selecionados.
        </p>
      )}
    </div>
  );
}

export function Workspace({ onLogout = () => {} }: { onLogout?: () => void }) {
  const [view, setView] = useState<View>("overview"),
    [chat, setChat] = useState(false),
    [search, setSearch] = useState(false),
    [notice, setNotice] = useState(false);
  const { notifications } = useStoreState();
  const currentUser = useCurrentUser();
  const [workspaceCompanies, setWorkspaceCompanies] = useState<WorkspaceCompany[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  useEffect(() => {
    let active = true;
    setWorkspaceLoading(true);
    listWorkspaceCompanies().then((companies) => {
      if (!active) return;
      setWorkspaceCompanies(companies);
      setSelectedCompanyId((current) => companies.some((company) => company.id === current) ? current : companies[0]?.id ?? "");
      setWorkspaceError("");
    }).catch((cause: Error) => {
      if (active) setWorkspaceError(cause.message || "Não foi possível carregar os clientes do banco.");
    }).finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, []);
  const selectedCompany = workspaceCompanies.find((company) => company.id === selectedCompanyId);
  const selectedProduct = selectedCompany?.products.find((product) => product.id === selectedProductId);
  const unread = notifications.filter((n) => !n.read).length;
  const go = (v: View) => {
    setView(v);
    setNotice(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const page = (() => {
    switch (view) {
      case "clients":
        return <RealClients companies={workspaceCompanies} loading={workspaceLoading} error={workspaceError} go={go} onSelect={setSelectedCompanyId} />;
      case "client":
        return <RealClientDetail company={selectedCompany} go={go} />;
      case "catalog":
        return <RealCatalog company={selectedCompany} go={go} onSelectProduct={setSelectedProductId} />;
      case "requests":
        return <RequestsPage />;
      case "product":
        return <RealProduct product={selectedProduct} company={selectedCompany} go={go} />;
      case "review":
        return <LiveDataPlaceholder title="Revisão de produto" description="A revisão será exibida quando houver produtos persistidos aguardando ação." />;
      case "pending":
        return <LiveDataPlaceholder title="Pendências" description="Pendências reais do catálogo aparecerão aqui." />;
      case "pending-detail":
        return <LiveDataPlaceholder title="Detalhe da pendência" description="Selecione uma pendência persistida para ver seus detalhes." />;
      case "import":
        return <LiveDataPlaceholder title="Importar catálogo" description="A importação será habilitada quando o fluxo de arquivos estiver conectado ao backend." />;
      case "import-result":
        return <LiveDataPlaceholder title="Resultado da importação" description="Os resultados serão exibidos após uma importação persistida." />;
      case "activity":
        return currentUser ? <ActivityPage viewer={currentUser} onNavigate={(target) => go(target === "product" ? "product" : "requests")} /> : null;
      case "users":
        return <LiveDataPlaceholder title="Usuários e acessos" description="Usuários e permissões reais aparecerão quando forem vinculados ao backend." />;
      case "settings":
        return <Settings />;
      case "assistant":
        return <LiveDataPlaceholder title="Assistente PRISMA" description="O assistente será habilitado quando houver uma fonte de dados e conversas persistidas." />;
      case "add-client":
        return <FormPage go={go} type="client" onClientCreated={(company) => { setSelectedCompanyId(company.id); setWorkspaceCompanies((current) => [...current, company].sort((a, b) => a.name.localeCompare(b.name))); }} />;
      case "create-product":
        return <FormPage go={go} type="product" />;
      default:
        return <RealOverview companies={workspaceCompanies} loading={workspaceLoading} error={workspaceError} go={go} />;
    }
  })();
  return (
    <div className="workspace">
      <AppTop
        go={go}
        onSearch={() => setSearch(true)}
        onNotify={() => setNotice((v) => !v)}
        onLogout={onLogout}
        unread={unread}
      />
      <Rail active={view} go={go} openChat={() => setChat(true)} />
      <main className="ws-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24 }}
          >
            {page}
          </motion.div>
        </AnimatePresence>
      </main>
      {notice && (
        <NoticePopover
          notifications={notifications}
          onNavigate={(n) => {
            markNotificationRead(n.id);
            go(n.productId ? "product" : "catalog");
          }}
        />
      )}
      <AnimatePresence>
        {search && (
          <motion.div
            className="ws-overlay"
            onClick={() => setSearch(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="ws-search-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.985 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <button className="ws-close" onClick={() => setSearch(false)}>
                <Glyph name="close" />
              </button>
              <label>
                <Glyph name="search" />
                <input autoFocus placeholder="Buscar em toda a plataforma" />
              </label>
              <h3>Resultados rápidos</h3>
              <button onClick={() => go("product")}>
                <strong>Motor Elétrico XP-200</strong>
                <span>Atlas Importações · 8501.10.19</span>
              </button>
              <button onClick={() => go("client")}>
                <strong>Atlas Importações</strong>
                <span>12.345.678/0001-90</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chat && (
          <motion.aside
            className="ws-chat-panel"
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "spring", stiffness: 290, damping: 28 }}
          >
            <div>
              <strong>Assistente PRISMA</strong>
              <button onClick={() => setChat(false)}>
                <Glyph name="close" />
              </button>
            </div>
            <p>
              Contexto atual:{" "}
              <b>{view === "product" ? "Motor XP-200" : "Atlas Importações"}</b>
            </p>
            <div className="panel-ai">
              O que você gostaria de saber sobre este contexto?
            </div>
            <div className="ws-chat-input">
              <input placeholder="Pergunte sobre esta tela…" />
              <button>
                <Glyph name="arrow" />
              </button>
            </div>
            <button className="ws-link" onClick={() => go("assistant")}>
              Abrir assistente completo <Glyph name="arrow" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
