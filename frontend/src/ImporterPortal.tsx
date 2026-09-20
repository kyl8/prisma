import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { AppNotification, AppUser, Product } from "./data";
import { getImporterNotifications, getImporterProducts, getImporterProfile, markAllImporterNotificationsRead, markImporterNotificationRead, saveImporterProduct } from "./api/importer";
import { Glyph, GlyphName } from "./icons";
import {
  fieldLabelOf,
  importerStatusLabel,
  notificationGlyph,
  openCorrectionsOf,
  productCompleteness,
  showToast,
  useCurrentUser,
} from "./store";
import { ThemeToggle } from "./theme";
import { Dropdown, Modal, NoticePopover, SoundToggle } from "./ui";
import { playUISound } from "./utils/uiSounds";
import { ImporterActivityPage } from "./features/activity/ImporterActivityPage";
import { askAssistant } from "./features/assistant/assistantApi";
import "./importer.css";

type ImpView =
  | { name: "home" }
  | { name: "catalog"; initialTab?: string }
  | { name: "product"; productId: string; focusField?: string }
  | { name: "pending" }
  | { name: "notifications" }
  | { name: "activity" }
  | { name: "help" }
  | { name: "assistant" };

function ImpStatus({ product }: { product: Product }) {
  const label = importerStatusLabel(product);
  const cls =
    label === "Aprovado"
      ? "is-done"
      : label === "Correção solicitada"
        ? "is-correction"
        : label === "Precisa de você"
          ? "is-needs"
          : "is-sent";
  return <span className={`ws-status imp-status ${cls}`}>{label}</span>;
}

function ImpMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="ws-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const navItems: { view: ImpView; icon: GlyphName; label: string }[] = [
  { view: { name: "home" }, icon: "home", label: "Início" },
  { view: { name: "catalog" }, icon: "boxes", label: "Meu catálogo" },
  { view: { name: "pending" }, icon: "alert", label: "Pendências" },
  { view: { name: "notifications" }, icon: "bell", label: "Notificações" },
  { view: { name: "activity" }, icon: "pulse", label: "Atividade" },
  { view: { name: "assistant" }, icon: "robot", label: "Assistente" },
  { view: { name: "help" }, icon: "chat", label: "Ajuda" },
];

function ImpHome({
  go,
  user,
  companyName,
  companyCnpj,
  companyId,
  notifications,
  products,
}: {
  go: (v: ImpView) => void;
  user: { name: string };
  companyName: string;
  companyCnpj: string;
  companyId: string;
  notifications: AppNotification[];
  products: Product[];
}) {
  const mine = products.filter((p) => p.companyId === companyId);
  const avg = mine.length
    ? Math.round(
        mine.reduce((sum, p) => sum + productCompleteness(p), 0) /
          mine.length,
      )
    : 0;
  const needs = mine.filter((p) => p.status === "needs_you").length;
  const corrections = mine.filter(
    (p) => openCorrectionsOf(p).length > 0,
  ).length;
  const inReview = mine.filter((p) => p.status === "sent_for_review").length;
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Olá, {user.name.split(" ")[0]}.</h1>
          <p>Veja o que precisa da sua atenção.</p>
        </div>
      </div>
      <div className="ws-card imp-company-card">
        <div className="imp-company">
          <div>
            <h2>{companyName}</h2>
            <p>CNPJ {companyCnpj}</p>
          </div>
          <div>
            <strong>{avg}%</strong>
            <span>do catálogo completo</span>
          </div>
        </div>
        <i className="ws-progress big">
          <b style={{ width: `${avg}%` }} />
        </i>
      </div>
      <div className="ws-metrics-grid">
        <ImpMetric value={mine.length} label="Produtos" />
        <ImpMetric value={needs} label="Precisam de informação" />
        <ImpMetric value={corrections} label="Correções solicitadas" />
        <ImpMetric value={inReview} label="Em revisão" />
      </div>
      <div className="ws-card">
        <header className="ws-card-head">
          <h2>O que precisa da sua atenção</h2>
        </header>
        {needs > 0 && (
          <div className="ws-priority">
            <span>
              <Glyph name="file" />
            </span>
            <div>
              <strong>Complete informações pendentes</strong>
              <p>
                {needs} produto{needs > 1 ? "s" : ""} possuem informações
                obrigatórias pendentes.
              </p>
            </div>
            <button onClick={() => go({ name: "catalog", initialTab: "preciso" })}>
              Continuar preenchimento <Glyph name="arrow" />
            </button>
          </div>
        )}
        {corrections > 0 && (
          <div className="ws-priority">
            <span>
              <Glyph name="alert" />
            </span>
            <div>
              <strong>Correções solicitadas</strong>
              <p>
                {corrections} produto{corrections > 1 ? "s" : ""}{" "}
                {corrections > 1 ? "foram" : "foi"} devolvido
                {corrections > 1 ? "s" : ""} pelo despachante para ajuste.
              </p>
            </div>
            <button onClick={() => go({ name: "pending" })}>
              Ver correções <Glyph name="arrow" />
            </button>
          </div>
        )}
        {inReview > 0 && (
          <div className="ws-priority">
            <span>
              <Glyph name="check" />
            </span>
            <div>
              <strong>Produtos em revisão</strong>
              <p>
                {inReview} produto{inReview > 1 ? "s" : ""}{" "}
                {inReview > 1 ? "estão" : "está"} sendo analisado
                {inReview > 1 ? "s" : ""} pelo seu despachante.
              </p>
            </div>
          </div>
        )}
        {needs === 0 && corrections === 0 && inReview === 0 && (
          <p className="ws-card-copy">
            Nenhuma pendência. Seu catálogo está em dia.
          </p>
        )}
      </div>
      <div className="ws-card">
        <header className="ws-card-head">
          <h2>Atividade recente</h2>
        </header>
        {notifications.slice(0, 4).map((n) => (
          <button
            className="imp-activity"
            key={n.id}
            onClick={() =>
              n.productId
                ? go({ name: "product", productId: n.productId })
                : go({ name: "notifications" })
            }
          >
            <span>
              <Glyph name={notificationGlyph(n.kind) as GlyphName} size={15} />
            </span>
            <p>
              <strong>{n.title}</strong>
              {n.description}
            </p>
            <time>{n.createdAt}</time>
          </button>
        ))}
        {notifications.length === 0 && (
          <p className="ws-card-copy">Nenhuma atividade recente.</p>
        )}
      </div>
    </>
  );
}

const catalogTabs: [string, string][] = [
  ["todos", "Todos"],
  ["preciso", "Preciso preencher"],
  ["correcoes", "Correções solicitadas"],
  ["revisao", "Em revisão"],
  ["aprovados", "Aprovados"],
];

function ImpCatalog({
  go,
  companyId,
  initialTab,
  products,
}: {
  go: (v: ImpView) => void;
  companyId: string;
  initialTab?: string;
  products: Product[];
}) {
  const [tab, setTab] = useState(initialTab ?? "todos");
  const [search, setSearch] = useState("");
  const mine = products.filter((p) => p.companyId === companyId);
  const filtered = mine.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.ncm.includes(search);
    const matchTab =
      tab === "todos" ||
      (tab === "preciso" && p.status === "needs_you") ||
      (tab === "correcoes" && p.status === "correction_requested") ||
      (tab === "revisao" && p.status === "sent_for_review") ||
      (tab === "aprovados" && p.status === "approved");
    return matchSearch && matchTab;
  });
  const actionLabel = (p: Product) =>
    p.status === "needs_you"
      ? "Continuar"
      : p.status === "correction_requested"
        ? "Corrigir"
        : "Visualizar";
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Meu catálogo</h1>
          <p>
            Preencha e acompanhe as informações dos produtos da sua empresa.
          </p>
        </div>
      </div>
      <div className="ws-card ws-table-card">
        <div className="ws-tools">
          <label>
            <Glyph name="search" />
            <input
              placeholder="Buscar produto, código ou NCM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="ws-tabs imp-tabs">
          {catalogTabs.map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
              {tab === key && (
                <motion.span
                  className="imp-tab-line"
                  layoutId="imp-tab-line"
                  transition={{ type: "spring", stiffness: 500, damping: 42 }}
                />
              )}
            </button>
          ))}
        </div>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="imp-table">
          <div className="imp-cols imp-th">
            <span>Produto</span>
            <span>Código interno</span>
            <span>NCM</span>
            <span>Completude</span>
            <span>Status</span>
            <span>Última atualização</span>
            <span />
          </div>
          {filtered.map((p) => (
            <button
              className="imp-cols imp-tr"
              key={p.id}
              onClick={() => go({ name: "product", productId: p.id })}
            >
              <strong>{p.name}</strong>
              <span className="imp-cod">{p.sku}</span>
              <span className="imp-ncm">{p.ncm}</span>
              <span className="imp-comp">
                <i className="ws-bar">
                  <b style={{ width: `${productCompleteness(p)}%` }} />
                </i>
                {productCompleteness(p)}%
              </span>
              <span className="imp-status-cell">
                <ImpStatus product={p} />
              </span>
              <span className="imp-upd">{p.updatedAt}</span>
              <span className="imp-action">
                {actionLabel(p)} <Glyph name="arrow" size={13} />
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="ws-empty">Nenhum produto encontrado.</p>
          )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function ImpProduct({
  go,
  productId,
  focusField,
  companyId,
  products,
  viewer,
  onRefresh,
}: {
  go: (v: ImpView) => void;
  productId: string;
  focusField?: string;
  companyId: string;
  products: Product[];
  viewer: ReturnType<typeof useCurrentUser>;
  onRefresh: () => Promise<void>;
}) {
  const product = products.find(
    (p) => p.id === productId && p.companyId === companyId,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(product?.attributes.map((a) => [a.key, a.value]) ?? []),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!product) {
    return <p className="ws-empty">Produto não encontrado.</p>;
  }
  const filled = Object.values(values).filter((v) => v.trim()).length;
  const total = product.attributes.length;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const corrections = openCorrectionsOf(product);
  const groups: [string, string][] = [
    ["identificacao", "Identificação"],
    ["classificacao", "Classificação"],
    ["caracteristicas", "Características"],
    ["personalizados", "Solicitado pelo despachante"],
  ];
  const missingRequired = product.attributes.filter(
    (a) => a.required && !(values[a.key] ?? "").trim(),
  );
  const saveDraft = async () => {
    setSaving(true);
    try { await saveImporterProduct(productId, values, false, viewer); showToast("Rascunho salvo"); playUISound("save"); } catch { showToast("Não foi possível salvar as informações"); playUISound("error"); } finally { setSaving(false); }
  };
  const submit = async () => {
    if (missingRequired.length > 0) {
      setShowErrors(true);
      showToast("Preencha os campos obrigatórios antes de enviar");
      playUISound("warning");
      return;
    }
    await saveImporterProduct(productId, values, true, viewer);
    await onRefresh();
    showToast("Enviado para revisão");
    go({ name: "home" });
  };
  return (
    <>
      <button className="imp-back" onClick={() => go({ name: "catalog" })}>
        <span>
          <Glyph name="arrow" size={14} />
        </span>
        Meu catálogo
      </button>
      <div className="ws-page-title">
        <div>
          <h1>{product.name}</h1>
          <p>
            Código {product.sku} · NCM {product.ncm}
          </p>
        </div>
        <ImpStatus product={product} />
      </div>
      {corrections.length > 0 && (
        <div className="imp-banner">
          <Glyph name="alert" size={16} />
          <div>
            <strong>
              Correção solicitada por {corrections[0].requestedBy} ·{" "}
              {corrections[0].requestedByTitle}
            </strong>
            <p>
              {corrections.map((c) => (
                <span key={c.id}>
                  {fieldLabelOf(product, c.fieldKey)}: {c.note}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}
      <div className="imp-product-layout">
        <div className="imp-product-form">
          {groups.map(([g, label]) => {
            const attrs = product.attributes.filter((a) => a.group === g);
            if (attrs.length === 0) return null;
            return (
              <div className="ws-card" key={g}>
                <header className="ws-card-head">
                  <h2>{label}</h2>
                </header>
                <div className="imp-form-grid">
                  {attrs.map((a) => {
                    const hasError =
                      showErrors && a.required && !(values[a.key] ?? "").trim();
                    return (
                      <label
                        key={a.key}
                        className={[
                          "imp-field",
                          focusField === a.key ? "is-target" : "",
                          hasError ? "is-error" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span>
                          {a.label}
                          {a.required ? " *" : ""}
                        </span>
                        {a.note && <small>{a.note}</small>}
                        <input
                          value={values[a.key] ?? ""}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [a.key]: e.target.value,
                            }))
                          }
                          placeholder={`Adicionar ${a.label.toLowerCase()}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="ws-form-actions">
            <button className="ws-quiet" onClick={saveDraft}>
              Salvar rascunho
            </button>
            <button className="ws-primary" onClick={submit}>
              {corrections.length > 0
                ? "Enviar correções para revisão"
                : "Enviar para revisão"}{" "}
              <Glyph name="arrow" />
            </button>
          </div>
        </div>
        <div className="imp-product-side">
          <div className="ws-card">
            <header className="ws-card-head">
              <h2>Progresso</h2>
            </header>
            <div className="ws-big-number">{pct}%</div>
            <p className="ws-big-number-sub">
              {filled} de {total} informações preenchidas
            </p>
            <i className="ws-progress">
              <b style={{ width: `${pct}%` }} />
            </i>
          </div>
          <div className="ws-card">
            <header className="ws-card-head">
              <h2>Atributos para a NCM {product.ncm}</h2>
            </header>
            <p className="ws-card-copy">
              A NCM indica quais atributos o despachante precisa validar antes
              da revisão. Campos com * são obrigatórios.
            </p>
            <ul className="imp-required">
              {product.attributes
                .filter((a) => a.required)
                .map((a) => (
                  <li key={a.key}>
                    <Glyph name="check" size={13} /> {a.label}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function ImpPending({
  go,
  companyId,
  products,
}: {
  go: (v: ImpView) => void;
  companyId: string;
  products: Product[];
}) {
  const mine = products.filter((p) => p.companyId === companyId);
  const corrections = mine.flatMap((p) =>
    openCorrectionsOf(p).map((c) => ({ product: p, correction: c })),
  );
  const needs = mine.filter((p) => p.status === "needs_you");
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Pendências</h1>
          <p>Correções e informações que precisam da sua atenção.</p>
        </div>
      </div>
      <div className="ws-card">
        <header className="ws-card-head">
          <h2>Correções solicitadas</h2>
        </header>
        {corrections.length === 0 && (
          <p className="ws-card-copy">Nenhuma correção solicitada.</p>
        )}
        {corrections.map(({ product, correction }) => (
          <div className="imp-correction" key={correction.id}>
            <div className="imp-correction-head">
              <strong>{product.name}</strong>
              <span>
                Correção solicitada por {correction.requestedBy} ·{" "}
                {correction.requestedByTitle}
              </span>
            </div>
            <div className="imp-correction-body">
              <div>
                <span>Campo</span>
                <strong>{fieldLabelOf(product, correction.fieldKey)}</strong>
              </div>
              <div>
                <span>Valor atual</span>
                <strong>{correction.currentValue}</strong>
              </div>
              <div>
                <span>Observação</span>
                <p>{correction.note}</p>
              </div>
            </div>
            <button
              className="ws-primary"
              onClick={() =>
                go({
                  name: "product",
                  productId: product.id,
                  focusField: correction.fieldKey,
                })
              }
            >
              Corrigir informação <Glyph name="arrow" />
            </button>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <header className="ws-card-head">
          <h2>Informações pendentes</h2>
        </header>
        {needs.length === 0 && (
          <p className="ws-card-copy">Nenhuma informação pendente.</p>
        )}
        {needs.map((p) => (
          <div className="imp-need" key={p.id}>
            <span>
              <Glyph name="file" size={15} />
            </span>
            <p>
              <strong>{p.name}</strong>
              <small>
                {p.attributes.filter((a) => a.required && !a.value.trim()).length}{" "}
                informações obrigatórias pendentes
              </small>
            </p>
            <button
              className="ws-quiet"
              onClick={() => go({ name: "product", productId: p.id })}
            >
              Continuar preenchimento <Glyph name="arrow" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ImpNotifications({
  go,
  companyId,
  notifications,
  viewer,
  onRead,
}: {
  go: (v: ImpView) => void;
  companyId: string;
  notifications: AppNotification[];
  viewer: ReturnType<typeof useCurrentUser>;
  onRead: (id: string) => void;
}) {
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Notificações</h1>
          <p>Acompanhe o que mudou no seu catálogo.</p>
        </div>
        <button
          className="ws-quiet"
          onClick={() => markAllImporterNotificationsRead(viewer).then(() => onRead("all")).catch(() => showToast("Não foi possível atualizar as notificações"))}
        >
          Marcar todas como lidas
        </button>
      </div>
      <div className="ws-card">
        {notifications.map((n) => (
          <button
            className="imp-notif"
            key={n.id}
            onClick={() => {
              markImporterNotificationRead(n.id, viewer).catch(() => showToast("Não foi possível atualizar a notificação"));
              onRead(n.id);
              if (n.productId) {
                go({ name: "product", productId: n.productId });
              }
            }}
          >
            <span className="imp-notif-icon">
              <Glyph name={notificationGlyph(n.kind) as GlyphName} size={15} />
            </span>
            <div>
              <strong>{n.title}</strong>
              <p>{n.description}</p>
              <small>{n.createdAt}</small>
            </div>
            {!n.read && <i className="imp-unread" />}
          </button>
        ))}
        {notifications.length === 0 && (
          <p className="ws-empty">Nenhuma notificação.</p>
        )}
      </div>
    </>
  );
}

const helpItems: [string, string][] = [
  [
    "Como preencher meu catálogo?",
    "Abra Meu catálogo, escolha um produto com status “Precisa de você” e complete os campos marcados com * antes de enviar para revisão.",
  ],
  [
    "Por que preciso informar a NCM?",
    "A NCM define quais atributos são exigidos na importação. Com ela, o despachante sabe exatamente o que validar e você preenche só o necessário.",
  ],
  [
    "O que significa correção solicitada?",
    "Seu despachante revisou o produto e pediu um ajuste em um campo específico. Abra o produto, corrija a informação e envie novamente para revisão.",
  ],
  [
    "Como enviar um produto para revisão?",
    "Complete as informações obrigatórias e clique em “Enviar para revisão”. O despachante é avisado automaticamente.",
  ],
];

function ImpHelp({
  companyId,
  dispatcherName,
  dispatcherInitials,
  companyName,
}: {
  companyId: string;
  dispatcherName: string;
  dispatcherInitials: string;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Central de ajuda</h1>
          <p>Respostas rápidas sobre o preenchimento do catálogo.</p>
        </div>
      </div>
      <div className="imp-help-grid">
        {helpItems.map(([q, a]) => (
          <div className="ws-card" key={q}>
            <h2 className="imp-help-title">{q}</h2>
            <p className="ws-card-copy">{a}</p>
          </div>
        ))}
      </div>
      <div className="ws-card">
        <header className="ws-card-head">
          <h2>Precisa falar com seu despachante?</h2>
        </header>
        <div className="imp-contact">
          <div className="ws-person">
            <span>{dispatcherInitials}</span>
            <div>
              <strong>{dispatcherName}</strong>
              <small>Despachante responsável pela {companyName}</small>
            </div>
          </div>
          <button className="ws-primary" onClick={() => setOpen(true)}>
            Enviar mensagem
          </button>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Enviar mensagem">
        <p className="ws-card-copy" style={{ marginBottom: 14 }}>
          Sua mensagem será encaminhada para {dispatcherName}, despachante da{" "}
          {companyName}.
        </p>
        <label className="ws-field">
          <span>Mensagem</span>
          <textarea
            placeholder="Escreva sua dúvida sobre o catálogo…"
            defaultValue={`Olá, ${dispatcherName.split(" ")[0]}.`}
          />
        </label>
        <div className="ws-modal-actions">
          <button className="ws-quiet" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button
            className="ws-primary"
            onClick={() => {
              setOpen(false);
              // Simulação: em produção, dispararia e-mail para o despachante.
              showToast("Mensagem enviada — simulação");
              playUISound("success");
            }}
          >
            Enviar mensagem
          </button>
        </div>
      </Modal>
    </>
  );
}

const assistantPrompts = [
  "O que falta no meu catálogo?",
  "Quais produtos têm correções?",
  "Como enviar um produto para revisão?",
  "Quais produtos foram aprovados?",
];

function ImpAssistant({
  go,
  companyId,
  products,
}: {
  go: (v: ImpView) => void;
  companyId: string;
  products: Product[];
}) {
  const [prompt, setPrompt] = useState(assistantPrompts[0]);
  const [remoteAnswer, setRemoteAnswer] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantNotice, setAssistantNotice] = useState("");
  const [context, setContext] = useState("Todo o catálogo");
  const [conversations, setConversations] = useState<string[]>([]);
  const mine = products.filter((p) => p.companyId === companyId);
  const needs = mine.filter((p) => p.status === "needs_you");
  const corrections = mine.filter((p) => openCorrectionsOf(p).length > 0);
  const approved = mine.filter((p) => p.status === "approved");
  const contextProduct = mine.find((p) => p.name === context);

  const ask = async (message: string) => {
    const next = message.trim();
    if (!next) return;
    setPrompt(next);
    setRemoteAnswer(null);
    setAssistantError("");
    setAssistantNotice("");
    setAssistantLoading(true);
    try {
      const response = await askAssistant({ message: next, companyId, productId: contextProduct?.id });
      setRemoteAnswer(response.answer);
      setAssistantNotice(response.warning ?? "");
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Não foi possível consultar o assistente.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const messages = useMemo(() => {
    if (contextProduct) {
      const missing = contextProduct.attributes.filter((a) => !a.value.trim());
      return {
        answer:
          missing.length > 0
            ? `${contextProduct.name} está ${productCompleteness(contextProduct)}% completo. Faltam ${missing.length} informação(ões):`
            : `${contextProduct.name} está completo (${productCompleteness(contextProduct)}%).`,
        items: missing.slice(0, 3).map((a) => ({
          label: a.label,
          target: {
            name: "product",
            productId: contextProduct.id,
            focusField: a.key,
          } as ImpView,
        })),
        action: "Abrir produto",
        actionTarget: {
          name: "product",
          productId: contextProduct.id,
        } as ImpView,
      };
    }
    if (prompt.includes("correç")) {
      return {
        answer:
          corrections.length > 0
            ? `Você tem ${corrections.length} produto(s) com correção solicitada. Abra cada um, ajuste o campo indicado e envie novamente para revisão.`
            : "Nenhuma correção solicitada no momento.",
        items: corrections.map((p) => ({
          label: `${p.name} · ${fieldLabelOf(p, openCorrectionsOf(p)[0].fieldKey)}`,
          target: { name: "pending" } as ImpView,
        })),
        action: "Ver pendências",
        actionTarget: { name: "pending" } as ImpView,
      };
    }
    if (prompt.includes("revisão") || prompt.includes("revisao")) {
      return {
        answer:
          "Complete todos os campos obrigatórios (marcados com *) e clique em “Enviar para revisão” no produto. Seu despachante é avisado automaticamente.",
        items: needs.slice(0, 3).map((p) => ({
          label: `${p.name} · ${productCompleteness(p)}%`,
          target: { name: "product", productId: p.id } as ImpView,
        })),
        action: "Ver catálogo",
        actionTarget: { name: "catalog" } as ImpView,
      };
    }
    if (prompt.includes("aprovad")) {
      return {
        answer:
          approved.length > 0
            ? `${approved.length} produto(s) aprovados pelo seu despachante. Nenhuma ação necessária.`
            : "Nenhum produto aprovado até agora.",
        items: approved.map((p) => ({
          label: `${p.name} · ${p.ncm}`,
          target: { name: "product", productId: p.id } as ImpView,
        })),
        action: "Ver catálogo",
        actionTarget: { name: "catalog" } as ImpView,
      };
    }
    return {
      answer:
        needs.length > 0
          ? `${needs.length} produto(s) precisam de informação. Comece pelo primeiro da lista abaixo.`
          : "Seu catálogo está completo. Nenhuma informação pendente.",
      items: needs.slice(0, 3).map((p) => ({
        label: `${p.name} · ${p.attributes.filter((a) => a.required && !a.value.trim()).length} campos pendentes`,
        target: { name: "product", productId: p.id } as ImpView,
      })),
      action: "Ver catálogo",
      actionTarget: { name: "catalog" } as ImpView,
    };
  }, [prompt, contextProduct, needs, corrections, approved]);

  return (
    <>
      <div className="ws-page-title">
        <div>
          <h1>Assistente PRISMA</h1>
          <p>Converse sobre seus produtos, pendências e correções.</p>
        </div>
      </div>
      <div className="ws-chat-layout">
        <div className="ws-card ws-chat-card">
          <div className="ws-context">
            <span>Contexto:</span>
            <Dropdown
              options={["Todo o catálogo", ...mine.map((p) => p.name)]}
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
                  <p>{assistantLoading ? "Pensando… consultando catálogo e Logcomex" : remoteAnswer ?? "Faça uma pergunta para consultar dados reais do catálogo."}</p>
                  {assistantNotice && <small className="ws-assistant-notice">{assistantNotice}</small>}
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
              if (message) void ask(message);
            }}
          >
            <button type="button" aria-label="Anexar arquivo">
              <Glyph name="plus" />
            </button>
            <input
              name="message"
              placeholder="Pergunte sobre seus produtos ou pendências…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  void ask(e.currentTarget.value);
                }
              }}
            />
            <button type="submit" aria-label="Enviar">
              <Glyph name="arrow" />
            </button>
          </form>
          <div className="ws-suggest">
            {assistantPrompts.map((q) => (
              <button key={q} onClick={() => void ask(q)}>
                {q}
              </button>
            ))}
          </div>
          {assistantError && <p className="ws-empty" role="alert">{assistantError}</p>}
        </div>
        <div className="ws-card ws-chat-history">
          <header className="ws-card-head">
            <h2>Conversas</h2>
            <button
              className="ws-quiet ws-chat-new"
              onClick={() => {
                setConversations((c) => ["Nova conversa", ...c]);
                setContext("Todo o catálogo");
                setPrompt(assistantPrompts[0]);
              }}
            >
              <Glyph name="plus" size={13} /> Nova conversa
            </button>
          </header>
          {conversations.map((x) => (
            <button key={x} onClick={() => setPrompt(x)}>
              {x}
              <Glyph name="arrow" size={13} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function ImporterPortal({ onLogout }: { onLogout: () => void }) {
  const sessionUser = useCurrentUser();
  const [user, setUser] = useState<(AppUser & { company: { id: string; name: string; cnpj: string }; dispatcher: { id: string; name: string | null; email: string; company: string } | null }) | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ImpView>({ name: "home" });
  const [chat, setChat] = useState(false);
  const [search, setSearch] = useState(false);
  const [notice, setNotice] = useState(false);
  const [query, setQuery] = useState("");
  const [panelPrompt, setPanelPrompt] = useState("");
  const [panelAnswer, setPanelAnswer] = useState("");
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const company = user?.company;
  const load = async () => {
    if (!sessionUser) return;
    setLoading(true); setError("");
    try {
      const profile = await getImporterProfile(sessionUser);
      const [nextProducts, nextNotifications] = await Promise.all([getImporterProducts(profile), getImporterNotifications(profile)]);
      setUser(profile); setProducts(nextProducts); setNotifications(nextNotifications);
    } catch { setError("Não foi possível carregar os dados do portal."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [sessionUser?.id]);
  const go = (v: ImpView) => {
    setView(v);
    setNotice(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (loading) return <div className="workspace imp-workspace"><p className="ws-empty">Carregando...</p></div>;
  if (error || !user || !company) return <div className="workspace imp-workspace"><div className="ws-empty"><p>{error || "Sessão inválida."}</p><button className="ws-quiet" onClick={() => void load()}>Tentar novamente</button></div></div>;
  const companyNotifications = notifications;
  const unread = companyNotifications.filter((n) => !n.read).length;
  const myProducts = products.filter((p) => p.companyId === company.id);
  const searchResults = myProducts
    .filter(
      (p) =>
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()) ||
        p.ncm.includes(query),
    )
    .slice(0, 5);
  const openFromSearch = (productId: string) => {
    setSearch(false);
    setQuery("");
    go({ name: "product", productId });
  };
  const askPanel = async () => {
    const message = panelPrompt.trim();
    if (!message || panelLoading) return;
    setPanelLoading(true);
    setPanelError("");
    try {
      const response = await askAssistant({ message, companyId: company.id, productId: view.name === "product" ? view.productId : undefined });
      setPanelAnswer(response.answer);
      setPanelPrompt("");
    } catch (cause) {
      setPanelError(cause instanceof Error ? cause.message : "NÃ£o foi possÃ­vel consultar o assistente.");
    } finally {
      setPanelLoading(false);
    }
  };
  const Page = () => {
    switch (view.name) {
      case "catalog":
        return (
          <ImpCatalog
            go={go}
            companyId={company.id}
            initialTab={view.initialTab}
            products={products}
          />
        );
      case "product":
        return (
          <ImpProduct
            go={go}
            productId={view.productId}
            focusField={view.focusField}
            companyId={company.id}
            products={products}
            viewer={user}
            onRefresh={load}
          />
        );
      case "pending":
        return <ImpPending go={go} companyId={company.id} products={products} />;
      case "notifications":
        return (
          <ImpNotifications
            go={go}
            companyId={company.id}
            notifications={companyNotifications}
            viewer={user}
            onRead={(id) => setNotifications((current) => id === "all" ? current.map((item) => ({ ...item, read: true })) : current.map((item) => item.id === id ? { ...item, read: true } : item))}
          />
        );
      case "help":
        return (
          <ImpHelp
            companyId={company.id}
            dispatcherName={user.dispatcher?.name ?? "Despachante responsável"}
            dispatcherInitials={(user.dispatcher?.name ?? "DR").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            companyName={company.name}
          />
        );
      case "activity":
        return <ImporterActivityPage viewer={user} onProduct={() => go({ name: "catalog" })} />;
      case "assistant":
        return <ImpAssistant go={go} companyId={company.id} products={products} />;
      default:
        return (
          <ImpHome
            go={go}
            user={user}
            companyName={company.name}
            companyCnpj={company.cnpj}
            companyId={company.id}
            notifications={companyNotifications}
            products={products}
          />
        );
    }
  };
  return (
    <div className="workspace imp-workspace">
      <header className="ws-top">
        <button className="ws-brand" onClick={() => go({ name: "home" })}>
          <span>P</span>PRISMA
        </button>
        <div className="ws-utilities">
          <ThemeToggle className="ws-utility-theme" />
          <SoundToggle />
          <button aria-label="Buscar" onClick={() => setSearch(true)}>
            <Glyph name="search" />
          </button>
          <button
            className={unread > 0 ? "ws-bell has-unread" : "ws-bell"}
            aria-label={`Notificações (${unread} não lidas)`}
            onClick={() => setNotice((v) => !v)}
          >
            <span className="ws-bell-icon" key={unread}>
              <Glyph name="bell" />
            </span>
            {unread > 0 && <i />}
          </button>
          <button className="ws-profile" aria-label="Minha conta">
            <span>{user.initials}</span>
            <b className="imp-identity">
              {user.name}
              <small>{company.name}</small>
            </b>
          </button>
          <button className="ws-logout" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>
      {notice && (
        <NoticePopover
          notifications={companyNotifications}
          onNavigate={(n) => {
            markImporterNotificationRead(n.id, user).catch(() => showToast("Não foi possível atualizar a notificação"));
            go(
              n.productId
                ? { name: "product", productId: n.productId }
                : { name: "pending" },
            );
          }}
        />
      )}
      <aside className="ws-rail" aria-label="Navegação do importador">
        {navItems.map(({ view: target, icon, label }) => (
          <div className="ws-rail-item" key={label}>
            <button
              title={label}
              className={view.name === target.name ? "active" : ""}
              onClick={() => (label === "Assistente" ? setChat(true) : go(target))}
              aria-label={label}
            >
              <Glyph name={icon} />
            </button>
            {label === "Assistente" && (
              <button
                className="ws-rail-full"
                title="Assistente completo"
                aria-label="Abrir assistente completo"
                onClick={() => go({ name: "assistant" })}
              >
                <Glyph name="spark" />
              </button>
            )}
          </div>
        ))}
      </aside>
      <main className="ws-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={JSON.stringify(view)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.24 }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>
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
                <input
                  autoFocus
                  placeholder="Buscar produtos do seu catálogo"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <h3>Resultados rápidos</h3>
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => openFromSearch(p.id)}>
                  <strong>{p.name}</strong>
                  <span>
                    {p.sku} · {p.ncm} · {company.name}
                  </span>
                </button>
              ))}
              {query && searchResults.length === 0 && (
                <p className="ws-empty">Nenhum produto encontrado.</p>
              )}
              {!query && searchResults.length === 0 && (
                <p className="ws-empty">Nenhum produto no catálogo.</p>
              )}
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
            <div className="panel-ai">
              O que você gostaria de saber sobre esta operação?
            </div>
            {panelAnswer && <div className="panel-answer">{panelAnswer}</div>}
            {panelLoading && <div className="panel-thinking" role="status"><span className="panel-thinking-dot" />Pensando…</div>}
            {panelError && <div className="panel-error" role="alert"><span>{panelError}</span><button type="button" onClick={() => void askPanel()}>Tentar novamente</button></div>}
            <form className="ws-chat-input" onSubmit={(event) => { event.preventDefault(); void askPanel(); }}>
              <input value={panelPrompt} onChange={(event) => setPanelPrompt(event.target.value)} placeholder="Pergunte sobre seu catálogo…" disabled={panelLoading} />
              <button type="submit" aria-label="Enviar" disabled={panelLoading || !panelPrompt.trim()}>
                <Glyph name="arrow" />
              </button>
            </form>
            <button
              className="ws-link"
              onClick={() => {
                setChat(false);
                go({ name: "assistant" });
              }}
            >
              Abrir assistente completo <Glyph name="arrow" />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
