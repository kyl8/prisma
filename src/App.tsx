import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useState } from "react";
import { Workspace } from "./Workspace";

type IconName =
  | "arrow"
  | "boxes"
  | "chat"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "document"
  | "menu"
  | "people"
  | "search"
  | "shield"
  | "spark"
  | "warning";

const iconPaths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  boxes: (
    <>
      <path d="m12 3 7 4-7 4-7-4 7-4Z" />
      <path d="m5 12 7 4 7-4" />
      <path d="m5 17 7 4 7-4" />
    </>
  ),
  chat: (
    <>
      <path d="M7 18.5 3.5 21l.8-4.4A8.5 8.5 0 1 1 7 18.5Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </>
  ),
  check: <path d="m5 12 4.2 4L19 6.5" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h5M10 17h5" />
    </>
  ),
  menu: (
    <>
      <path d="M4 8h16M4 16h16" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
      <path d="M15 5.5a3 3 0 0 1 0 5M16 14c2.5.5 3.8 2.5 4 5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 2.7 8.2 7 10 4.3-1.8 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2c.3 4.8 2.8 7.2 7 7.5-4.2.3-6.7 2.8-7 7.5-.3-4.7-2.8-7.2-7-7.5C9.2 9.2 11.7 6.8 12 2Z" />
      <path d="M19 16c.1 2 1.1 3 3 3.2-1.9.1-2.9 1.2-3 3.1-.1-1.9-1.1-3-3-3.1 1.9-.2 2.9-1.2 3-3.2Z" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
      {iconPaths[name]}
    </svg>
  );
}

const ease = [0.16, 1, 0.3, 1] as const;

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <a
      className={`logo${inverse ? " logo--inverse" : ""}`}
      href="#top"
      aria-label="PRISMA — início"
    >
      <span className="logo-mark">P</span>
      <span>PRISMA</span>
    </a>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#plataforma">Plataforma</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#assistente">Assistente</a>
        </nav>
        <div className="header-actions">
          <a className="header-login" href="/app">
            Entrar
          </a>
          <a className="button button--dark header-cta" href="#demo">
            Ver demonstração <Icon name="arrow" size={17} />
          </a>
        </div>
        <button
          className="menu-button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            className="mobile-nav"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.35, ease }}
            aria-label="Navegação móvel"
          >
            <a href="#plataforma" onClick={() => setOpen(false)}>
              Plataforma
            </a>
            <a href="#como-funciona" onClick={() => setOpen(false)}>
              Como funciona
            </a>
            <a href="#assistente" onClick={() => setOpen(false)}>
              Assistente
            </a>
            <a href="/app" onClick={() => setOpen(false)}>
              Entrar na plataforma <Icon name="arrow" size={18} />
            </a>
            <a href="#demo" onClick={() => setOpen(false)}>
              Ver demonstração <Icon name="arrow" size={18} />
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <main className="login-screen">
      <a className="login-brand" href="/" aria-label="PRISMA — início">
        <span className="logo-mark">P</span> PRISMA
      </a>
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (email && password) onEnter();
        }}
      >
        <p className="eyebrow">ACESSO À PLATAFORMA</p>
        <h1>Entre no seu workspace.</h1>
        <p>
          Use qualquer e-mail e senha para explorar este protótipo
          demonstrativo.
        </p>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>
        <button className="button button--dark" type="submit">
          Entrar na plataforma <Icon name="arrow" size={17} />
        </button>
        <a href="/">Voltar para a página inicial</a>
      </form>
    </main>
  );
}

const statusRows = [
  { label: "Catálogo de produtos", value: "Revisado", tone: "done" },
  { label: "Documentos da carga", value: "2 pendências", tone: "warn" },
  { label: "Classificação fiscal", value: "Confirmada", tone: "done" },
  { label: "Retirada e destino", value: "Em análise", tone: "neutral" },
];

function DashboardMock({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<"visao" | "pendencias">("visao");
  return (
    <div className={`app-window${compact ? " app-window--compact" : ""}`}>
      <div className="window-bar">
        <span />
        <span />
        <span />
        <div>prisma / operação demonstrativa</div>
      </div>
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="mini-logo">P</div>
          <div className="sidebar-client">
            <span>Operação</span>
            <strong>BR-0482</strong>
          </div>
          <div className="sidebar-links">
            <button className="active" disabled aria-current="page">
              <Icon name="boxes" size={17} /> Visão geral
            </button>
            <button disabled title="Disponível na versão completa">
              <Icon name="document" size={17} /> Catálogo
            </button>
            <button disabled title="Disponível na versão completa">
              <Icon name="chat" size={17} /> Mensagens
            </button>
          </div>
          <div className="sidebar-user">
            <span>PM</span>
            <div>
              <strong>Paula Martins</strong>
              <small>Despachante</small>
            </div>
          </div>
        </aside>
        <div className="app-main">
          <div className="app-topline">
            <div>
              <span>Importação marítima</span>
              <strong>Atlas Componentes Ltda.</strong>
            </div>
            <button disabled title="Acesso compartilhado demonstrativo">
              <Icon name="people" size={17} /> Compartilhada
            </button>
          </div>
          <div className="app-title-row">
            <div>
              <h3>Prontidão da operação</h3>
              <p>Atualizada hoje, 14:32</p>
            </div>
            <div className="score">
              <strong>82</strong>
              <span>de 100</span>
            </div>
          </div>
          <div
            className="app-tabs"
            role="tablist"
            aria-label="Visões do painel"
          >
            <button
              onClick={() => setTab("visao")}
              className={tab === "visao" ? "active" : ""}
              role="tab"
              aria-selected={tab === "visao"}
              aria-controls="painel-visao"
            >
              Visão geral
            </button>
            <button
              onClick={() => setTab("pendencias")}
              className={tab === "pendencias" ? "active" : ""}
              role="tab"
              aria-selected={tab === "pendencias"}
              aria-controls="painel-pendencias"
            >
              Pendências <span>2</span>
            </button>
          </div>
          <AnimatePresence mode="wait">
            {tab === "visao" ? (
              <motion.div
                key="visao"
                id="painel-visao"
                role="tabpanel"
                className="readiness-panel"
                initial={{ opacity: 0.45, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="readiness-track">
                  <motion.span
                    initial={{ width: "24%" }}
                    whileInView={{ width: "82%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease }}
                  />
                </div>
                <div className="status-list">
                  {statusRows.map((row) => (
                    <div className="status-row" key={row.label}>
                      <span className={`status-dot ${row.tone}`}>
                        <Icon
                          name={
                            row.tone === "done"
                              ? "check"
                              : row.tone === "warn"
                                ? "warning"
                                : "clock"
                          }
                          size={15}
                        />
                      </span>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pendencias"
                id="painel-pendencias"
                role="tabpanel"
                className="issue-list"
                initial={{ opacity: 0.45, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <Icon name="warning" size={18} />
                  <p>
                    <strong>Peso líquido não informado</strong>
                    <span>Produto: Válvula industrial VX-80</span>
                  </p>
                  <button disabled title="Ação demonstrativa">
                    Corrigir
                  </button>
                </div>
                <div>
                  <Icon name="document" size={18} />
                  <p>
                    <strong>Licença de importação em revisão</strong>
                    <span>Documento atualizado há 2 dias</span>
                  </p>
                  <button disabled title="Ação demonstrativa">
                    Revisar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="hero" data-scroll-section id="top">
      <div className="hero-copy">
        <motion.h1
          initial={reduce ? false : { y: 48, opacity: 0, filter: "blur(12px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease }}
        >
          Veja o risco antes da carga chegar.
        </motion.h1>
        <motion.div
          className="hero-support"
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.18, ease }}
        >
          <p>
            Centralize catálogos, documentos e decisões em um só lugar. Antecipe
            pendências. Dê clareza a importadores e despachantes.
          </p>
          <a className="button button--dark" href="#plataforma">
            Explorar a plataforma <Icon name="arrow" size={18} />
          </a>
        </motion.div>
      </div>
      <motion.div
        className="hero-product"
        initial={
          reduce
            ? false
            : { y: 70, opacity: 0, clipPath: "inset(0 0 25% 0 round 16px)" }
        }
        animate={{ y: 0, opacity: 1, clipPath: "inset(0 0 0% 0 round 16px)" }}
        transition={{ duration: 1.05, delay: 0.28, ease }}
      >
        <div className="demo-label">Dados ilustrativos para demonstração</div>
        <DashboardMock />
      </motion.div>
    </section>
  );
}

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 1, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.8, ease }}
    >
      {children}
    </motion.div>
  );
}

function CatalogMock() {
  const [filter, setFilter] = useState<"todos" | "acao">("todos");
  const rows = [
    ["Bomba centrífuga CP-40", "8413.70.90", "Completo", "done"],
    ["Válvula industrial VX-80", "8481.80.99", "Requer ação", "warn"],
    ["Sensor de pressão SP-12", "9026.20.90", "Em revisão", "neutral"],
  ];
  return (
    <div className="product-canvas product-canvas--warm">
      <div className="catalog-card">
        <div className="mock-heading">
          <div>
            <h3>Catálogo de produtos</h3>
            <p>Atlas Componentes Ltda.</p>
          </div>
          <button disabled title="Ação demonstrativa">
            <span>+</span> Novo produto
          </button>
        </div>
        <div className="mock-tools">
          <div>
            <Icon name="search" size={17} />
            <span>Buscar por produto ou NCM</span>
          </div>
          <div className="segmented">
            <button
              className={filter === "todos" ? "active" : ""}
              onClick={() => setFilter("todos")}
              aria-pressed={filter === "todos"}
            >
              Todos
            </button>
            <button
              className={filter === "acao" ? "active" : ""}
              onClick={() => setFilter("acao")}
              aria-pressed={filter === "acao"}
            >
              Requer ação
            </button>
          </div>
        </div>
        <div className="catalog-table">
          <div className="table-head">
            <span>Produto</span>
            <span>NCM</span>
            <span>Status</span>
          </div>
          {rows
            .filter((r) => filter === "todos" || r[3] === "warn")
            .map((r) => (
              <motion.div layout className="table-row" key={r[0]}>
                <span>
                  <i>{r[0].slice(0, 1)}</i>
                  <strong>{r[0]}</strong>
                </span>
                <span>{r[1]}</span>
                <span>
                  <b className={`badge ${r[3]}`}>{r[2]}</b>
                </span>
              </motion.div>
            ))}
        </div>
        <p className="mock-footnote">
          <Icon name="shield" size={15} /> Alterações ficam registradas para
          toda a equipe.
        </p>
      </div>
    </div>
  );
}

function NcmMock() {
  const [checked, setChecked] = useState([true, false, false]);
  const toggle = (i: number) =>
    setChecked((v) => v.map((x, idx) => (idx === i ? !x : x)));
  return (
    <div className="product-canvas product-canvas--gray">
      <div className="ncm-card">
        <div className="ncm-title">
          <span>Classificação</span>
          <strong>NCM 8481.80.99</strong>
          <small>Outros dispositivos para canalizações</small>
        </div>
        <div className="ncm-rule" />
        <div className="ncm-guidance">
          <div className="guidance-title">
            <Icon name="spark" size={18} />
            <div>
              <strong>Atributos orientados pela NCM</strong>
              <span>Complete os campos antes de enviar à revisão.</span>
            </div>
          </div>
          {[
            "Material predominante",
            "Pressão máxima de trabalho",
            "Tipo de acionamento",
          ].map((label, i) => (
            <button
              className={checked[i] ? "checked" : ""}
              onClick={() => toggle(i)}
              key={label}
              aria-pressed={checked[i]}
              aria-label={`${label}: ${checked[i] ? "preenchido" : "informação necessária"}`}
            >
              <span>
                <Icon name="check" size={14} />
              </span>
              <div>
                <strong>{label}</strong>
                <small>
                  {checked[i] ? "Preenchido" : "Informação necessária"}
                </small>
              </div>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </div>
        <div className="ncm-footer">
          <span>{checked.filter(Boolean).length} de 3 completos</span>
          <div>
            <i
              style={{
                width: `${(checked.filter(Boolean).length / 3) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CollaborationMock() {
  return (
    <div className="product-canvas product-canvas--ink">
      <div className="collab-card">
        <div className="collab-head">
          <div>
            <span>VX</span>
            <div>
              <strong>Válvula industrial VX-80</strong>
              <small>Revisão compartilhada</small>
            </div>
          </div>
          <div className="avatars">
            <span>PM</span>
            <span>RC</span>
          </div>
        </div>
        <div className="comment">
          <div className="comment-author">
            <span>PM</span>
            <div>
              <strong>Paula · Despachante</strong>
              <small>Hoje, 10:18</small>
            </div>
          </div>
          <p>
            Ricardo, confirme se a pressão informada é a máxima de trabalho.
            Esse atributo precisa acompanhar a ficha técnica.
          </p>
          <div className="comment-anchor">
            <Icon name="document" size={16} />
            <span>Pressão máxima de trabalho</span>
            <b>Pendente</b>
          </div>
        </div>
        <div className="reply">
          <span>RC</span>
          <div>
            <strong>Ricardo · Importador</strong>
            <p>Confirmado: 16 bar. Anexei a ficha revisada.</p>
          </div>
          <Icon name="check" size={18} />
        </div>
        <div className="resolved">
          <Icon name="check" size={16} /> Pendência resolvida · 11:02
        </div>
      </div>
    </div>
  );
}

const quickQuestions = [
  "O que falta nesta operação?",
  "Como corrigir o catálogo?",
  "Quais documentos revisar?",
];

function AssistantMock() {
  const [question, setQuestion] = useState("O que falta nesta operação?");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(
    "Há duas ações antes do envio: completar o peso líquido da Válvula VX-80 e revisar a licença de importação anexada há 2 dias.",
  );
  const ask = (q: string) => {
    setQuestion(q);
    setLoading(true);
    setAnswer("");
    window.setTimeout(() => {
      setLoading(false);
      setAnswer(
        q.includes("catálogo")
          ? "Abra o item VX-80 e preencha o atributo “peso líquido”. A NCM já indicou esse campo como obrigatório para a revisão."
          : q.includes("documentos")
            ? "Priorize a licença de importação e confirme se a ficha técnica anexada contém pressão máxima, material e modelo comercial."
            : "Há duas ações antes do envio: completar o peso líquido da Válvula VX-80 e revisar a licença de importação anexada há 2 dias.",
      );
    }, 650);
  };
  return (
    <div className="assistant-shell">
      <div className="assistant-top">
        <div>
          <span className="assistant-symbol">
            <Icon name="spark" size={18} />
          </span>
          <div>
            <strong>Assistente PRISMA</strong>
            <small>Contexto da operação BR-0482</small>
          </div>
        </div>
        <span className="online">Disponível</span>
      </div>
      <div
        className="chat-area"
        role="status"
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="user-message">{question}</div>
        <div className="ai-message">
          <span>
            <Icon name="spark" size={16} />
          </span>
          <div>
            {loading ? (
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            ) : (
              <>
                <p>{answer}</p>
                <button
                  onClick={() =>
                    document
                      .getElementById("demo")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Ver pendências <Icon name="arrow" size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="quick-prompts">
        {quickQuestions.map((q) => (
          <button onClick={() => ask(q)} disabled={loading} key={q}>
            {q}
          </button>
        ))}
      </div>
      <div className="chat-input">
        <span>Use uma das perguntas sugeridas acima</span>
        <button
          disabled
          aria-label="Campo demonstrativo; use as perguntas sugeridas"
        >
          <Icon name="arrow" size={17} />
        </button>
      </div>
      <p className="assistant-note">
        Respostas ilustrativas. A integração com a Logcomex é uma proposta em
        validação.
      </p>
    </div>
  );
}

const faqs = [
  [
    "A PRISMA substitui o despachante?",
    "Não. A proposta organiza informações, aponta pendências e apoia a coordenação. A interpretação e a decisão especializada continuam com os profissionais da operação.",
  ],
  [
    "A plataforma já integra com DUIMP e Logcomex?",
    "Este protótipo demonstra a experiência desejada. Integrações com DUIMP, Siscomex e Logcomex ainda são hipóteses técnicas e comerciais a validar.",
  ],
  [
    "Quem atualiza o catálogo de produtos?",
    "Importador e despachante trabalham no mesmo ambiente. O importador pode completar dados e anexos, enquanto o despachante revisa e solicita correções.",
  ],
  [
    "Como a prontidão é calculada?",
    "A proposta combina sinais cadastrais, documentais e operacionais. Os pesos e regras finais ainda dependem de validação com usuários e parceiros.",
  ],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="faq-section" data-scroll-section id="faq">
      <div className="faq-wrap">
        <h2>
          Perguntas que merecem
          <br />
          respostas claras.
        </h2>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div
              className={`faq-item${open === i ? " open" : ""}`}
              key={faq[0]}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                id={`faq-trigger-${i}`}
              >
                <span>{faq[0]}</span>
                <i>{open === i ? "−" : "+"}</i>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease }}
                  >
                    <p>{faq[1]}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function App() {
  const isWorkspace = window.location.pathname.startsWith("/app");
  const [authenticated, setAuthenticated] = useState(
    () => window.sessionStorage.getItem("prisma-demo-access") === "true",
  );
  useEffect(() => {
    document.documentElement.classList.add("js");
    return () => document.documentElement.classList.remove("js");
  }, []);
  useEffect(() => {
    if (isWorkspace || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const lenis = new Lenis({
      smoothWheel: true,
      duration: 1,
      wheelMultiplier: 0.95,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    let snapLocked = false;
    let lastSnapAt = 0;
    let wheelAccumulator = 0;
    let wheelResetTimeout = 0;
    let burstStartedAt = 0;
    const getHeaderOffset = () =>
      window.matchMedia("(max-width: 620px)").matches ? 68 : 84;
    const getSections = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-scroll-section]"),
      ).filter((section) => section.offsetParent !== null);

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if ((event.target as HTMLElement | null)?.closest(".quick-prompts")) return;
      if (snapLocked) {
        event.preventDefault();
        return;
      }
      if (Date.now() - lastSnapAt < 420) return;

      const now = Date.now();
      if (burstStartedAt === 0 || now - burstStartedAt > 180) {
        burstStartedAt = now;
        wheelAccumulator = 0;
      }
      wheelAccumulator += event.deltaY;
      window.clearTimeout(wheelResetTimeout);
      wheelResetTimeout = window.setTimeout(() => {
        wheelAccumulator = 0;
        burstStartedAt = 0;
      }, 120);

      const absDelta = Math.abs(event.deltaY);
      const absAccumulated = Math.abs(wheelAccumulator);
      const isStrongSingle = absDelta >= 180;
      const isStrongBurst = absAccumulated >= 280;
      if (!isStrongSingle && !isStrongBurst) return;

      const direction = wheelAccumulator > 0 ? 1 : -1;
      wheelAccumulator = 0;
      burstStartedAt = 0;
      const sections = getSections().sort((a, b) => a.offsetTop - b.offsetTop);
      if (sections.length < 2) return;

      const headerOffset = getHeaderOffset();
      const currentPosition = window.scrollY + headerOffset;
      const threshold = 14;
      let targetSection: HTMLElement | undefined;

      if (direction > 0) {
        targetSection = sections.find(
          (section) => section.offsetTop > currentPosition + threshold,
        );
      } else {
        for (let i = sections.length - 1; i >= 0; i -= 1) {
          if (sections[i].offsetTop < currentPosition - threshold) {
            targetSection = sections[i];
            break;
          }
        }
      }
      if (!targetSection) return;

      event.preventDefault();
      snapLocked = true;
      lastSnapAt = Date.now();
      lenis.scrollTo(targetSection, {
        offset: -headerOffset,
        duration: 1.05,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        lock: true,
        onComplete: () => {
          window.setTimeout(() => {
            snapLocked = false;
          }, 120);
        },
      });
    };

    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      const href = trigger?.getAttribute("href");
      if (!href || href.length < 2) return;
      const section = document.querySelector<HTMLElement>(href);
      if (!section) return;

      event.preventDefault();
      const offset = window.matchMedia("(max-width: 620px)").matches ? 68 : 84;
      lenis.scrollTo(section, {
        offset: -offset,
        duration: 0.9,
      });
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("click", handleAnchorClick);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      document.removeEventListener("click", handleAnchorClick);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(wheelResetTimeout);
      lenis.destroy();
    };
  }, [isWorkspace]);
  if (isWorkspace) {
    if (!authenticated)
      return (
        <LoginScreen
          onEnter={() => {
            window.sessionStorage.setItem("prisma-demo-access", "true");
            setAuthenticated(true);
          }}
        />
      );
    return <Workspace />;
  }
  return (
    <>
      <Header />
      <main>
        <Hero />
        <section className="statement" data-scroll-section aria-label="Proposta central">
          <Reveal>
            <p>
              Quando a informação chega tarde, o atraso começa antes do navio
              atracar.
            </p>
          </Reveal>
        </section>
        <section className="feature-section" data-scroll-section id="plataforma">
          <div className="feature-grid">
            <Reveal className="feature-visual">
              <CatalogMock />
            </Reveal>
            <Reveal className="feature-copy">
              <h2>
                Um catálogo.
                <br />
                Uma fonte de verdade.
              </h2>
              <p>
                Organize cada produto por cliente, acompanhe o que está completo
                e leve a correção para dentro do próprio fluxo — sem depender de
                mensagens dispersas.
              </p>
              <ul>
                <li>
                  <Icon name="check" size={16} /> Histórico compartilhado
                </li>
                <li>
                  <Icon name="check" size={16} /> Pendências por produto
                </li>
              </ul>
            </Reveal>
          </div>
        </section>
        <section
          className="feature-section feature-section--tint"
          data-scroll-section
          id="como-funciona"
        >
          <div className="feature-grid feature-grid--reverse">
            <Reveal className="feature-copy">
              <h2>
                A NCM orienta.
                <br />
                Você decide.
              </h2>
              <p>
                A classificação ativa uma lista objetiva de atributos
                necessários. Em vez de descobrir a ausência na revisão, o
                importador sabe o que preencher antes de enviar.
              </p>
              <p className="evidence-note">
                Conceito sustentado pelas evidências de informações incompletas
                e erros documentais observadas em 2 de 3 entrevistas.
              </p>
            </Reveal>
            <Reveal className="feature-visual">
              <NcmMock />
            </Reveal>
          </div>
        </section>
        <section className="feature-section" data-scroll-section>
          <div className="feature-grid">
            <Reveal className="feature-visual">
              <CollaborationMock />
            </Reveal>
            <Reveal className="feature-copy">
              <h2>
                Corrigir junto.
                <br />
                Sem perder contexto.
              </h2>
              <p>
                O despachante comenta no campo certo. O importador responde,
                anexa e resolve. Todos enxergam a mesma versão da operação.
              </p>
              <a className="text-link" href="#assistente">
                Conhecer o assistente <Icon name="arrow" size={17} />
              </a>
            </Reveal>
          </div>
        </section>
        <section className="assistant-section" data-scroll-section id="assistente">
          <div className="assistant-grid">
            <Reveal className="assistant-copy">
              <h2>
                Pergunte à operação,
                <br />
                não a dez abas.
              </h2>
              <p>
                O assistente transforma o contexto do catálogo, dos documentos e
                das pendências em próximos passos simples.
              </p>
              <div className="assist-principle">
                <Icon name="shield" />
                <span>
                  <strong>Apoio, não piloto automático.</strong> A resposta
                  mostra a origem da pendência e mantém a decisão com a equipe.
                </span>
              </div>
            </Reveal>
            <Reveal>
              <AssistantMock />
            </Reveal>
          </div>
        </section>
        <section className="demo-section" data-scroll-section id="demo">
          <div className="demo-heading">
            <Reveal>
              <h2>
                Uma visão para agir.
                <br />
                <span>Antes da chegada.</span>
              </h2>
              <p>
                Explore as duas visões do painel. Os dados abaixo são
                ilustrativos e representam a experiência proposta.
              </p>
            </Reveal>
          </div>
          <Reveal className="demo-dashboard">
            <DashboardMock compact />
          </Reveal>
        </section>
        <Faq />
        <section className="final-cta" data-scroll-section>
          <Reveal>
            <h2>
              Menos ruído na origem.
              <br />
              Mais previsibilidade no destino.
            </h2>
            <a
              className="button button--light"
              href="mailto:contato@prisma.demo"
            >
              Conversar com a PRISMA <Icon name="arrow" size={18} />
            </a>
            <p>Protótipo conceitual · Porto Hack Santos 2026</p>
          </Reveal>
        </section>
      </main>
    </>
  );
}
