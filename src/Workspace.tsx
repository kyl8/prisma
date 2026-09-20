import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import "./workspace.css";

type View =
  | "overview"
  | "clients"
  | "client"
  | "catalog"
  | "product"
  | "review"
  | "pending"
  | "pending-detail"
  | "import"
  | "import-result"
  | "importer-home"
  | "importer-catalog"
  | "guided"
  | "corrections"
  | "activity"
  | "users"
  | "settings"
  | "assistant"
  | "add-client"
  | "create-product";

type GlyphName =
  | "home"
  | "people"
  | "boxes"
  | "alert"
  | "download"
  | "chat"
  | "robot"
  | "pulse"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "more"
  | "arrow"
  | "check"
  | "close"
  | "upload"
  | "filter"
  | "file"
  | "chevron";
const paths: Record<GlyphName, React.ReactNode> = {
  home: (
    <>
      <path d="m4 11 8-7 8 7v9H4z" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 5.5a3 3 0 0 1 0 5M16 14c2.5.5 3.8 2.5 4 5" />
    </>
  ),
  boxes: (
    <>
      <path d="m12 3 7 4-7 4-7-4 7-4Z" />
      <path d="m5 12 7 4 7-4" />
      <path d="m5 17 7 4 7-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  chat: (
    <>
      <path d="M7 18.5 3.5 21l.8-4.4A8.5 8.5 0 1 1 7 18.5Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  robot: (
    <>
      <rect x="6" y="8" width="12" height="10" rx="2.5" />
      <path d="M12 4v3M8.5 13h.01M15.5 13h.01M9.5 16h5" />
    </>
  ),
  pulse: (
    <>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.6-1H5.2v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.6 1h.2v3H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  more: (
    <>
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  check: <path d="m5 12 4.2 4L19 6.5" />,
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  file: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h5M10 17h5" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
};
function Glyph({ name, size = 18 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

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
const products = [
  [
    "Motor Elétrico XP-200",
    "MTR-0021",
    "8501.10.19",
    "92%",
    "Aguardando importador",
    "Importador",
    "Hoje",
  ],
  [
    "Sensor Industrial A12",
    "SNS-119",
    "9031.80.99",
    "100%",
    "Aprovado",
    "—",
    "Ontem",
  ],
  [
    "Válvula Industrial VX-80",
    "VLV-089",
    "8481.80.99",
    "78%",
    "Correção solicitada",
    "Importador",
    "17 set",
  ],
];

function Status({ children }: { children: string }) {
  return (
    <span
      className={`ws-status ${children.includes("Aprovado") || children.includes("Completo") ? "is-done" : children.includes("Atenção") || children.includes("Correção") || children.includes("pendência") ? "is-warn" : ""}`}
    >
      {children}
    </span>
  );
}
function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="ws-metric">
      <strong>{value}</strong>
      <span>{label}</span>
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
function Breadcrumb({ children }: { children: string }) {
  return <div className="ws-breadcrumb">{children}</div>;
}

function Table({
  onProduct,
  onClient,
  pending = false,
  search = "",
  statusFilter = "Todos",
  ncmFilter = "Todas",
  completudeFilter = "Todas",
}: {
  onProduct?: () => void;
  onClient?: () => void;
  pending?: boolean;
  search?: string;
  statusFilter?: string;
  ncmFilter?: string;
  completudeFilter?: string;
}) {
  const [menu, setMenu] = useState<number | null>(null);
  const [productList, setProductList] = useState(products);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    return productList.filter((row) => {
      const matchSearch =
        !search ||
        row[0].toLowerCase().includes(search.toLowerCase()) ||
        row[1].toLowerCase().includes(search.toLowerCase()) ||
        row[2].includes(search);
      const matchStatus =
        statusFilter === "Todos" || row[4] === statusFilter;
      const matchNcm =
        ncmFilter === "Todas" || row[2] === ncmFilter;
      const matchComp =
        completudeFilter === "Todas" ||
        (completudeFilter === "100%" ? row[3] === "100%" : row[3] !== "100%");
      return matchSearch && matchStatus && matchNcm && matchComp;
    });
  }, [productList, search, statusFilter, ncmFilter, completudeFilter]);

  const handleDelete = (idx: number) => {
    setProductList((prev) => prev.filter((_, i) => i !== idx));
    setMenu(null);
  };

  const handleCopyNcm = (idx: number, ncm: string) => {
    navigator.clipboard?.writeText(ncm);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
    setMenu(null);
  };

  if (pending)
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
        {[
          [
            "Informar composição do material",
            "Motor XP-200",
            "Atlas Importações",
            "Importador",
            "17/09",
            "Aguardando cliente",
          ],
          [
            "Revisar NCM informada",
            "Válvula VX-80",
            "Ocean Trade",
            "Despachante",
            "16/09",
            "Em revisão",
          ],
          [
            "Anexar ficha técnica",
            "Sensor A12",
            "Atlas Importações",
            "Importador",
            "15/09",
            "Atrasada",
          ],
        ].map((r) => (
          <button className="ws-tr pending-cols" onClick={onProduct} key={r[0]}>
            {r.map((v, i) => (
              <span key={v}>{i === 5 ? <Status>{v}</Status> : v}</span>
            ))}
          </button>
        ))}
      </div>
    );
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
          <div className="ws-row-wrap" key={row[0]}>
            <div
              className="ws-tr product-cols"
              onClick={onProduct}
              role="button"
              tabIndex={0}
            >
              <strong>{row[0]}</strong>
              <span>{row[1]}</span>
              <span>{row[2]}</span>
              <span>
                <i className="ws-bar">
                  <b style={{ width: row[3] }} />
                </i>
                {row[3]}
              </span>
              <span>
                <Status>{row[4]}</Status>
              </span>
              <span>{row[5]}</span>
              <span>{row[6]}</span>
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
                      handleCopyNcm(idx, row[2]);
                    }}
                  >
                    {copiedIndex === idx ? "✓ Copiado!" : `Copiar NCM (${row[2]})`}
                  </button>
                  <button
                    className="is-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(idx);
                    }}
                  >
                    Excluir do catálogo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </>
  );
}

function AppTop({
  go,
  onSearch,
  onNotify,
  onLogout,
}: {
  go: (v: View) => void;
  onSearch: () => void;
  onNotify: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="ws-top">
      <button className="ws-brand" onClick={() => go("overview")}>
        <span>P</span>PRISMA
      </button>
      <div className="ws-utilities">
        <button aria-label="Buscar" onClick={onSearch}>
          <Glyph name="search" />
        </button>
        <button aria-label="Notificações" onClick={onNotify}>
          <Glyph name="bell" />
          <i />
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
        <button
          key={id}
          title={label}
          className={active === id ? "active" : ""}
          onClick={() => (id === "assistant" ? openChat() : go(id))}
          aria-label={label}
        >
          <Glyph name={icon} />
        </button>
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
          <div className="ws-tool-select-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por Status"
            >
              <option value="Todos">Status: Todos</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Atenção necessária">Atenção necessária</option>
              <option value="Completo">Completo</option>
            </select>
            <Glyph name="chevron" size={15} />
          </div>
          <div className="ws-tool-select-wrap">
            <select
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
              aria-label="Filtrar por Responsável"
            >
              <option value="Todos">Responsável: Todos</option>
              <option value="Importador">Importador</option>
              <option value="Despachante">Despachante</option>
            </select>
            <Glyph name="chevron" size={15} />
          </div>
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
                    <button onClick={() => setMenu(null)}>Convidar usuário</button>
                    <button onClick={() => setMenu(null)}>Editar cliente</button>
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
      </div>
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
          <div className="ws-tool-select-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por Status"
            >
              <option value="Todos">Status: Todos</option>
              <option value="Aguardando importador">Aguardando importador</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Correção solicitada">Correção solicitada</option>
            </select>
            <Glyph name="chevron" size={15} />
          </div>
          <div className="ws-tool-select-wrap">
            <select
              value={ncmFilter}
              onChange={(e) => setNcmFilter(e.target.value)}
              aria-label="Filtrar por NCM"
            >
              <option value="Todas">NCM: Todas</option>
              <option value="8501.10.19">8501.10.19</option>
              <option value="9031.80.99">9031.80.99</option>
              <option value="8481.80.99">8481.80.99</option>
              <option value="8413.70.90">8413.70.90</option>
              <option value="8537.10.90">8537.10.90</option>
            </select>
            <Glyph name="chevron" size={15} />
          </div>
          <div className="ws-tool-select-wrap">
            <select
              value={completudeFilter}
              onChange={(e) => setCompletudeFilter(e.target.value)}
              aria-label="Filtrar por Completude"
            >
              <option value="Todas">Completude: Todas</option>
              <option value="100%">100% (Completo)</option>
              <option value="incomplete">&lt; 100% (Incompleto)</option>
            </select>
            <Glyph name="chevron" size={15} />
          </div>
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
              <button className="ws-quiet">
                Enviar correções ao importador
              </button>
              <button className="ws-primary" onClick={() => go("product")}>
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
          <button className="ws-quiet" onClick={() => go("pending-detail")}>
            Solicitar correção
          </button>
          <button className="ws-primary" onClick={() => go("review")}>
            Aprovar
          </button>
        </div>
      </div>
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
      </div>
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
          <button>
            Cliente <Glyph name="chevron" />
          </button>
          <button>
            CNPJ <Glyph name="chevron" />
          </button>
          <button>
            Responsável <Glyph name="chevron" />
          </button>
          <button>
            Tipo <Glyph name="chevron" />
          </button>
          <button>
            Status <Glyph name="chevron" />
          </button>
        </div>
        <Table pending onProduct={() => go("pending-detail")} />
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
  { col: "Produto", sample: "Motor Elétrico XP-200", defaultMap: "Nome do produto" },
  { col: "NCM", sample: "8501.10.19", defaultMap: "NCM (Classificação Fiscal)" },
  { col: "Descrição", sample: "Motores elétricos de potência inferior...", defaultMap: "Descrição comercial" },
  { col: "Código / SKU", sample: "MTR-0021", defaultMap: "Código interno / SKU" },
  { col: "Fabricante", sample: "Volter Tech", defaultMap: "Fabricante / Marca" },
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
                Associe as colunas detectadas no arquivo <strong>catalogo_setembro.xlsx</strong> aos campos cadastrais do PRISMA.
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
                      <select
                        value={columnMappings[row.col] || row.defaultMap}
                        onChange={(e) => handleMappingChange(row.col, e.target.value)}
                        aria-label={`Mapeamento para coluna ${row.col}`}
                      >
                        {prismaFieldOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <Glyph name="chevron" size={16} />
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
                <p>Revise o resumo da operação antes de atualizar o catálogo.</p>
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
                <button className="ws-primary" onClick={() => go("import-result")}>
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
function ImporterHome({ go }: { go: (v: View) => void }) {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Olá, Mariana</h1>
          <p>Veja o que precisa da sua atenção.</p>
        </div>
      </div>
      <Card title="Seu catálogo" className="ws-card--large">
        <div className="ws-catalog-summary">
          <div>
            <h2>Atlas Importações</h2>
            <p>12.345.678/0001-90</p>
          </div>
          <div>
            <strong>88%</strong>
            <span>completo</span>
          </div>
        </div>
        <i className="ws-progress big">
          <b style={{ width: "88%" }} />
        </i>
      </Card>
      <div className="ws-metrics-grid">
        <Metric value="182" label="Produtos" />
        <Metric value="18" label="Precisam de informação" />
        <Metric value="4" label="Correções solicitadas" />
        <Metric value="7" label="Em revisão" />
      </div>
      <Card title="O que você precisa fazer">
        <div className="ws-action-row">
          <p>
            <strong>
              11 produtos possuem informações obrigatórias pendentes.
            </strong>
            <span>Complete dados antes do envio para revisão.</span>
          </p>
          <button onClick={() => go("guided")}>
            Continuar preenchimento <Glyph name="arrow" />
          </button>
        </div>
        <div className="ws-action-row">
          <p>
            <strong>4 produtos possuem correções solicitadas.</strong>
            <span>Seu despachante deixou instruções em cada produto.</span>
          </p>
          <button onClick={() => go("corrections")}>
            Corrigir produto <Glyph name="arrow" />
          </button>
        </div>
      </Card>
    </>
  );
}
function ImporterCatalog({ go }: { go: (v: View) => void }) {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Meu Catálogo</h1>
          <p>Complete as informações que faltam antes da revisão.</p>
        </div>
      </div>
      <Card className="ws-table-card">
        <div className="ws-tools">
          <label>
            <Glyph name="search" />
            <input placeholder="Buscar produto" />
          </label>
        </div>
        <div className="ws-tabs">
          <button className="active">Todos</button>
          <button>Preciso preencher</button>
          <button>Correções solicitadas</button>
          <button>Em revisão</button>
          <button>Aprovados</button>
        </div>
        {products.map((p) => (
          <button
            className="ws-importer-product"
            key={p[0]}
            onClick={() =>
              go(p[0].includes("Válvula") ? "corrections" : "guided")
            }
          >
            <div>
              <strong>{p[0]}</strong>
              <span>NCM {p[2]}</span>
            </div>
            <span>{p[3]} completo</span>
            <p>
              {p[0].includes("Motor")
                ? "Faltam 3 informações."
                : "Em revisão pelo despachante."}
            </p>
            <b>
              {p[0].includes("Motor")
                ? "Continuar preenchimento"
                : "Ver produto"}
              <Glyph name="arrow" />
            </b>
          </button>
        ))}
      </Card>
    </>
  );
}
function Guided({ go }: { go: (v: View) => void }) {
  const [done, setDone] = useState(0);
  const fields = ["Material", "Potência", "Tensão", "Aplicação"];
  return (
    <>
      <Breadcrumb>Meu Catálogo / Motor Elétrico XP-200</Breadcrumb>
      <div className="ws-page-title">
        <div>
          <h1>Complete as informações</h1>
          <p>Motor Elétrico XP-200 · 8 de 12 informações concluídas</p>
        </div>
      </div>
      <div className="ws-layout guided-layout">
        <Card title="Informações pendentes" className="ws-card--large">
          {fields.map((f, i) => (
            <label className="ws-guided-field" key={f}>
              <strong>{f} *</strong>
              <span>
                {f === "Material"
                  ? "Informe o material principal utilizado no produto."
                  : `Informe ${f.toLowerCase()} indicada pelo fabricante.`}
              </span>
              <input
                placeholder={`Adicionar ${f.toLowerCase()}`}
                onChange={() => setDone(Math.max(done, i + 1))}
              />
            </label>
          ))}
          <div className="ws-form-actions">
            <button className="ws-quiet">Salvar</button>
            <button
              className="ws-primary"
              onClick={() => go("importer-catalog")}
            >
              Salvar e próximo produto
            </button>
          </div>
        </Card>
        <Card title="Progresso">
          <div className="ws-big-number">
            {8 + done} <span>/ 12</span>
          </div>
          <i className="ws-progress">
            <b style={{ width: `${((8 + done) / 12) * 100}%` }} />
          </i>
          <p className="ws-card-copy">4 produtos restantes</p>
        </Card>
      </div>
    </>
  );
}
function Corrections({ go }: { go: (v: View) => void }) {
  const [resolved, setResolved] = useState(2);
  const corrections = [
    ["Material", "Alumínio", "Informe também a composição percentual."],
    ["Aplicação", "—", "Explique onde o equipamento será utilizado."],
  ];
  return (
    <>
      <Breadcrumb>Meu Catálogo / Motor Elétrico XP-200</Breadcrumb>
      <div className="ws-page-title">
        <div>
          <h1>Correções solicitadas</h1>
          <p>
            O despachante precisa de algumas informações antes da aprovação.
          </p>
        </div>
      </div>
      <div className="ws-layout guided-layout">
        <Card title="Motor Elétrico XP-200" className="ws-card--large">
          <p className="ws-card-copy">{resolved} de 3 correções concluídas</p>
          <i className="ws-progress">
            <b style={{ width: `${(resolved / 3) * 100}%` }} />
          </i>
          {corrections.map(([field, value, message]) => (
            <div className="ws-guided-field" key={field}>
              <strong>{field}</strong>
              <span>Valor atual: {value}</span>
              <span>
                <b>Mensagem do despachante:</b> {message}
              </span>
              <input placeholder={`Corrigir ${field.toLowerCase()}`} />
              <button className="ws-quiet" onClick={() => setResolved(3)}>
                Marcar como resolvido
              </button>
            </div>
          ))}
          <div className="ws-form-actions">
            <button
              className="ws-primary"
              onClick={() => go("importer-catalog")}
            >
              Enviar novamente para revisão <Glyph name="arrow" />
            </button>
          </div>
        </Card>
        <Card title="Próximo passo">
          <p className="ws-card-copy">
            Quando todas as correções estiverem resolvidas, envie o produto
            novamente para o despachante.
          </p>
        </Card>
      </div>
    </>
  );
}
function Activity({ go }: { go: (v: View) => void }) {
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
          <button>
            Cliente <Glyph name="chevron" />
          </button>
          <button>
            Usuário <Glyph name="chevron" />
          </button>
          <button>
            Tipo <Glyph name="chevron" />
          </button>
          <button>
            Data <Glyph name="chevron" />
          </button>
        </div>
        <Timeline go={go} />
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
              <button>
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
            <Integration
              name="Portal Único / Siscomex"
              state="Não configurado"
            />
            <Integration name="Logcomex" state="Não configurado" />
            <Integration name="ERP" state="Não configurado" />
            <Integration name="API" state="Disponível" />
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
  const messages = useMemo(
    () =>
      prompt.includes("Motor")
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
    [prompt],
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
            <button>
              Todos os clientes <Glyph name="chevron" />
            </button>
          </div>
          <div className="ws-chat-log">
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
                        : "pending",
                    )
                  }
                >
                  {messages.action}
                </button>
              </div>
            </div>
          </div>
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
        </Card>
        <Card
          title="Conversas"
          className="ws-chat-history"
          action={<button className="ws-quiet">Nova conversa</button>}
        >
          {[
            "Atlas — produtos incompletos",
            "Pendências desta semana",
            "Importação setembro",
            "Revisões pendentes",
          ].map((x) => (
            <button key={x}>
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
}: {
  go: (v: View) => void;
  type: "client" | "product";
}) {
  const [success, setSuccess] = useState(false);
  const isProduct = type === "product";

  if (success) {
    return (
      <Card className="ws-success">
        <span>
          <Glyph name="check" size={26} />
        </span>
        <h2>
          {isProduct
            ? "Produto salvo com sucesso."
            : "Cliente criado com sucesso."}
        </h2>
        <p>O fluxo demonstrativo foi concluído.</p>
        <div>
          <button
            className="ws-primary"
            onClick={() => go(isProduct ? "product" : "client")}
          >
            {isProduct ? "Abrir produto" : "Abrir cliente"}
          </button>
          {!isProduct && <button className="ws-quiet">Copiar convite</button>}
        </div>
      </Card>
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
          />
          <FormCard
            title="Responsável"
            fields={["Nome", "E-mail", "Telefone"]}
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
          <div className="ws-form-actions">
            <button className="ws-quiet" onClick={() => go("clients")}>
              Cancelar
            </button>
            <button className="ws-primary" onClick={() => setSuccess(true)}>
              Criar cliente <Glyph name="arrow" />
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
function FormCard({ title, fields }: { title?: string; fields: string[] }) {
  return (
    <Card title={title}>
      <div className="ws-form-fields">
        {fields.map((x) => (
          <label key={x}>
            <span>{x}</span>
            <input
              placeholder={`Adicionar ${x.replace(" *", "").toLowerCase()}`}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
function Timeline({ go }: { go: (v: View) => void }) {
  return (
    <div className="ws-timeline">
      {[
        ["14:10", "Carlos aprovou", "Motor Elétrico XP-200"],
        ["13:42", "Mariana atualizou", "Material"],
        [
          "11:03",
          "Sistema encontrou",
          "3 inconsistências em catalogo_setembro.xlsx",
        ],
        ["Ontem", "Carlos enviou lembrete", "Atlas Importações"],
      ].map((x) => (
        <button
          onClick={() => go(x[2].includes("Motor") ? "product" : "activity")}
          key={x.join()}
        >
          <time>{x[0]}</time>
          <span />
          <p>
            <strong>{x[1]}</strong>
            {x[2]}
          </p>
          <Glyph name="arrow" />
        </button>
      ))}
    </div>
  );
}

export function Workspace({ onLogout = () => {} }: { onLogout?: () => void }) {
  const [view, setView] = useState<View>("overview"),
    [chat, setChat] = useState(false),
    [search, setSearch] = useState(false),
    [notice, setNotice] = useState(false),
    [openingNotice, setOpeningNotice] = useState<View | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const go = (v: View) => {
    setView(v);
    setChat(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openFromNotice = (target: View) => {
    if (openingNotice) return;
    setOpeningNotice(target);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(false);
      setOpeningNotice(null);
      go(target);
    }, 220);
  };
  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );
  const Page = () => {
    switch (view) {
      case "clients":
        return <Clients go={go} />;
      case "client":
        return <ClientDetail go={go} />;
      case "catalog":
        return <Catalog go={go} />;
      case "product":
        return <Product go={go} />;
      case "review":
        return <Product go={go} review />;
      case "pending":
        return <Pending go={go} />;
      case "pending-detail":
        return <Pending go={go} detail />;
      case "import":
        return <Import go={go} />;
      case "import-result":
        return <Import go={go} result />;
      case "importer-home":
        return <ImporterHome go={go} />;
      case "importer-catalog":
        return <ImporterCatalog go={go} />;
      case "guided":
        return <Guided go={go} />;
      case "corrections":
        return <Corrections go={go} />;
      case "activity":
        return <Activity go={go} />;
      case "users":
        return <Users />;
      case "settings":
        return <Settings />;
      case "assistant":
        return <Assistant go={go} />;
      case "add-client":
        return <FormPage go={go} type="client" />;
      case "create-product":
        return <FormPage go={go} type="product" />;
      default:
        return <Overview go={go} />;
    }
  };
  return (
    <div className="workspace">
      <AppTop
        go={go}
        onSearch={() => setSearch(true)}
        onNotify={() => setNotice((v) => !v)}
        onLogout={onLogout}
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
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>
      {notice && (
        <div className="ws-popover notice">
          <h3>Notificações</h3>
          <button
            className={openingNotice === "catalog" ? "is-active" : ""}
            onClick={() => openFromNotice("catalog")}
          >
            <span>Atlas Importações atualizou 4 produtos.</span>
            {openingNotice === "catalog" && <small>Abrindo…</small>}
          </button>
          <button
            className={openingNotice === "pending" ? "is-active" : ""}
            onClick={() => openFromNotice("pending")}
          >
            <span>7 produtos aguardam sua revisão.</span>
            {openingNotice === "pending" && <small>Abrindo…</small>}
          </button>
          <button
            className={openingNotice === "import-result" ? "is-active" : ""}
            onClick={() => openFromNotice("import-result")}
          >
            <span>Importação concluída com 3 inconsistências.</span>
            {openingNotice === "import-result" && <small>Abrindo…</small>}
          </button>
        </div>
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
              initial={{ opacity: 0, y: -16, scale: 0.97, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, scale: 0.985, filter: "blur(2px)" }}
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
