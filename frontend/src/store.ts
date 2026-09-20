// ============================================================================
// PRISMA — Store de demonstração (sem backend)
// ============================================================================
// Estado local compartilhado entre o Workspace do Despachante e o Portal do
// Importador. Não persiste após recarregar a página (somente a sessão).
// ============================================================================

import { useSyncExternalStore } from "react";
import {
  AppNotification,
  AppUser,
  CatalogRequest,
  Company,
  Correction,
  NotificationKind,
  Product,
  companies as seedCompanies,
  initialNotifications,
  initialProducts,
  users,
} from "./data";
import { playUISound } from "./utils/uiSounds";

export type Route =
  | { name: "marketing" }
  | { name: "app" }
  | { name: "request"; token: string };

export type AppState = {
  products: Product[];
  notifications: AppNotification[];
  requests: CatalogRequest[];
  companies: Company[];
  currentUserId: string | null;
  /** Direção da cortina da tela de login: entrada ("home") ou logout ("logout"). */
  loginFrom: "home" | "logout";
  toast: { id: number; text: string } | null;
  route: Route;
};

const SESSION_KEY = "prisma-demo-user";
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "app") return { name: "app" };
  if (parts[0] === "r" && parts[1]) return { name: "request", token: parts[1] };
  return { name: "marketing" };
}

function cloneProducts(products: Product[]): Product[] {
  return products.map((p) => ({
    ...p,
    attributes: p.attributes.map((a) => ({ ...a })),
    corrections: p.corrections.map((c) => ({ ...c })),
  }));
}

function restoreSession(): string | null {
  try {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    return saved && users.some((u) => u.id === saved) ? saved : null;
  } catch {
    return null;
  }
}

let counter = 100;

function nowLabel(): string {
  const d = new Date();
  return d
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\./g, "");
}

function makeToken(length = 7): string {
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return token;
}

const state: AppState = {
  products: cloneProducts(initialProducts),
  notifications: initialNotifications.map((n) => ({ ...n })),
  requests: [],
  companies: [...seedCompanies],
  currentUserId: restoreSession(),
  loginFrom: "home",
  toast: null,
  route: parseRoute(window.location.pathname),
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    state.route = parseRoute(window.location.pathname);
    emit();
  });
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** Retorna o estado completo. Seletores devem filtrar no render (não no getSnapshot). */
export function useStoreState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => state.route);
}

export function useCurrentUser(): AppUser | null {
  const id = useSyncExternalStore(subscribe, () => state.currentUserId);
  return users.find((u) => u.id === id) ?? null;
}

export function useCompany(companyId: string | undefined): Company | undefined {
  const companies = useSyncExternalStore(subscribe, () => state.companies);
  return companies.find((c) => c.id === companyId);
}

// ── Sessão ───────────────────────────────────────────────────────────────────

export function login(userId: string) {
  if (!users.some((u) => u.id === userId)) return;
  state.currentUserId = userId;
  state.loginFrom = "home";
  try {
    window.sessionStorage.setItem(SESSION_KEY, userId);
  } catch {
    /* storage indisponível */
  }
  emit();
}

export function logout() {
  state.currentUserId = null;
  state.loginFrom = "logout";
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage indisponível */
  }
  emit();
}

// ── Navegação ────────────────────────────────────────────────────────────────

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  state.route = parseRoute(path);
  emit();
}

// ── Toast ────────────────────────────────────────────────────────────────────

let toastTimer: number | null = null;

export function showToast(text: string) {
  state.toast = { id: ++counter, text };
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    toastTimer = null;
    emit();
  }, 2400);
  emit();
}

export function dismissToast(id?: number) {
  if (id !== undefined && state.toast?.id !== id) return;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = null;
  state.toast = null;
  emit();
}

// ── Notificações + simulação de e-mail ───────────────────────────────────────

/**
 * SIMULAÇÃO DE E-MAIL TRANSACIONAL.
 * Em produção, este ponto dispararia o envio de e-mail ao importador
 * (ex.: Resend, AWS SES, SendGrid) e/ou push notification.
 * Neste protótipo o evento apenas alimenta o centro de notificações local.
 */
export function sendNotificationEvent(
  event: Omit<AppNotification, "id" | "read" | "createdAt">,
) {
  state.notifications.unshift({
    ...event,
    id: `n-${++counter}`,
    read: false,
    createdAt: nowLabel(),
  });
}

export function markNotificationRead(id: string) {
  const n = state.notifications.find((x) => x.id === id);
  if (n) n.read = true;
  emit();
}

export function markAllNotificationsRead(companyId: string) {
  state.notifications.forEach((n) => {
    if (n.companyId === companyId) n.read = true;
  });
  emit();
}

export function unreadCount(companyId?: string): number {
  return state.notifications.filter(
    (n) => !n.read && (!companyId || n.companyId === companyId),
  ).length;
}

// ── Produtos (isolamento por companyId) ──────────────────────────────────────

/**
 * Produtos visíveis para um importador: SEMPRE filtrados pelo companyId
 * do usuário logado. Nenhuma tela do importador recebe produtos de outra
 * empresa, mesmo que o estado contenha várias empresas.
 */
export function productsForCompany(companyId: string): Product[] {
  return state.products.filter((p) => p.companyId === companyId);
}

export function productCompleteness(product: Product): number {
  const total = product.attributes.length;
  const filled = product.attributes.filter(
    (a) => a.value.trim() !== "",
  ).length;
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

export function updateProductAttribute(
  productId: string,
  key: string,
  value: string,
) {
  const product = state.products.find((p) => p.id === productId);
  const attribute = product?.attributes.find((a) => a.key === key);
  if (!product || !attribute) return;
  attribute.value = value;
  product.updatedAt = nowLabel();
  emit();
}

export function updateProductAttributes(
  productId: string,
  values: Record<string, string>,
) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  product.attributes.forEach((a) => {
    if (values[a.key] !== undefined) a.value = values[a.key];
  });
  product.updatedAt = nowLabel();
  emit();
}

export function requestCorrection(
  productId: string,
  fieldKey: string,
  note: string,
) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const attribute = product.attributes.find((a) => a.key === fieldKey);
  const requester = users.find((u) => u.id === state.currentUserId);
  product.corrections.unshift({
    id: `cor-${++counter}`,
    productId,
    fieldKey,
    currentValue: attribute?.value || "—",
    note,
    requestedBy: requester?.name ?? "Despachante",
    requestedByTitle: requester?.title ?? "Despachante aduaneiro",
    createdAt: nowLabel(),
    status: "open",
  });
  product.status = "correction_requested";
  product.updatedAt = nowLabel();
  sendNotificationEvent({
    companyId: product.companyId,
    kind: "correction",
    title: "Correção solicitada",
    description: `${requester?.name ?? "O despachante"} solicitou uma correção em ${product.name}.`,
    productId,
  });
  playUISound("notification");
  emit();
}

export function resolveCorrection(
  productId: string,
  correctionId: string,
  newValue: string,
) {
  const product = state.products.find((p) => p.id === productId);
  const correction = product?.corrections.find((c) => c.id === correctionId);
  if (!product || !correction) return;
  const attribute = product.attributes.find((a) => a.key === correction.fieldKey);
  if (attribute) attribute.value = newValue;
  correction.status = "resolved";
  correction.resolvedValue = newValue;
  if (!product.corrections.some((c) => c.status === "open")) {
    product.status = "sent_for_review";
  }
  product.updatedAt = nowLabel();
  emit();
}

export function submitProductForReview(productId: string) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  product.corrections.forEach((c) => {
    if (c.status !== "open") return;
    const attribute = product.attributes.find((a) => a.key === c.fieldKey);
    if (attribute && attribute.value.trim()) {
      c.status = "resolved";
      c.resolvedValue = attribute.value;
    }
  });
  product.status = "sent_for_review";
  product.updatedAt = nowLabel();
  sendNotificationEvent({
    companyId: product.companyId,
    kind: "request",
    title: "Produto enviado para revisão",
    description: `${product.name} foi atualizado e enviado para revisão.`,
    productId,
  });
  playUISound("submit");
  emit();
}

export function approveProduct(productId: string) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  product.status = "approved";
  product.updatedAt = nowLabel();
  sendNotificationEvent({
    companyId: product.companyId,
    kind: "approved",
    title: "Produto aprovado",
    description: `${product.name} foi aprovado pelo despachante.`,
    productId,
  });
  playUISound("notification");
  emit();
}

export function removeProduct(productId: string) {
  const index = state.products.findIndex((p) => p.id === productId);
  if (index !== -1) state.products.splice(index, 1);
  emit();
}

export function addCompany(input: {
  name: string;
  cnpj: string;
  contactName: string;
  contactEmail: string;
}) {
  const id = `company-${++counter}`;
  state.companies.push({
    id,
    name: input.name,
    cnpj: input.cnpj,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
  });
  emit();
  return id;
}

// ── Status labels ────────────────────────────────────────────────────────────

export function importerStatusLabel(product: Product): string {
  switch (product.status) {
    case "needs_you":
      return "Precisa de você";
    case "sent_for_review":
      return "Enviado para revisão";
    case "correction_requested":
      return "Correção solicitada";
    case "approved":
      return "Aprovado";
  }
}

export function dispatcherStatusLabel(product: Product): string {
  switch (product.status) {
    case "needs_you":
      return "Aguardando importador";
    case "sent_for_review":
      return "Aguardando despachante";
    case "correction_requested":
      return "Correção solicitada";
    case "approved":
      return "Aprovado";
  }
}

export function requestStatusLabel(status: CatalogRequest["status"]): string {
  switch (status) {
    case "waiting":
      return "Aguardando preenchimento";
    case "in_progress":
      return "Em preenchimento";
    case "submitted":
      return "Enviado para revisão";
    case "completed":
      return "Concluído";
    case "expired":
      return "Expirado";
    case "cancelled":
      return "Cancelado";
  }
}

// ── Solicitações por link ────────────────────────────────────────────────────

/**
 * Produtos expostos por uma solicitação: interseção entre o companyId da
 * solicitação e os productIds incluídos nela. Nada mais é visível no link.
 */
export function productsForRequest(request: CatalogRequest): Product[] {
  return state.products.filter(
    (p) =>
      p.companyId === request.companyId &&
      request.productIds.includes(p.id),
  );
}

export function createCatalogRequest(input: {
  companyId: string;
  recipientName: string;
  recipientEmail: string;
  productIds: string[];
  expiresAt: string;
  message?: string;
  kind?: "fill" | "correction";
  correctionFieldKey?: string;
  correctionNote?: string;
}): CatalogRequest {
  const requester = users.find((u) => u.id === state.currentUserId);
  const request: CatalogRequest = {
    id: `REQ-${2048 + state.requests.length}`,
    token: makeToken(),
    companyId: input.companyId,
    createdByUserId: state.currentUserId ?? "u-carlos",
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    productIds: input.productIds,
    status: "waiting",
    createdAt: nowLabel(),
    expiresAt: input.expiresAt,
    message: input.message,
    kind: input.kind ?? "fill",
    correctionFieldKey: input.correctionFieldKey,
    correctionNote: input.correctionNote,
  };
  state.requests.unshift(request);
  sendNotificationEvent({
    companyId: input.companyId,
    kind: "request",
    title: "Nova solicitação de preenchimento",
    description: `${requester?.name ?? "O despachante"} solicitou informações sobre ${input.productIds.length} produto(s).`,
  });
  playUISound("success");
  emit();
  return request;
}

export function startRequest(token: string) {
  const request = state.requests.find((r) => r.token === token);
  if (request && request.status === "waiting") {
    request.status = "in_progress";
    emit();
  }
}

export function submitRequest(token: string) {
  const request = state.requests.find((r) => r.token === token);
  if (!request) return;
  request.status = "submitted";
  sendNotificationEvent({
    companyId: request.companyId,
    kind: "request",
    title: "Solicitação concluída",
    description: `${request.recipientName} enviou ${request.productIds.length} produto(s) para revisão.`,
  });
  playUISound("submit");
  emit();
}

export function fieldLabelOf(product: Product, fieldKey: string): string {
  return (
    product.attributes.find((a) => a.key === fieldKey)?.label ?? fieldKey
  );
}

export function openCorrectionsOf(product: Product): Correction[] {
  return product.corrections.filter((c) => c.status === "open");
}

// ── Campos personalizados (solicitados pelo despachante) ────────────────────

/** Campos custom que o despachante adicionou para pedir informação extra. */
export function customFieldsOf(product: Product): Product["attributes"] {
  return product.attributes.filter((a) => a.custom);
}

/**
 * Adiciona um campo personalizado ao produto. O importador passa a ver o
 * campo no formulário do portal (e nas solicitações por link) com a
 * instrução anexada.
 */
export function addCustomField(
  productId: string,
  input: { label: string; required: boolean; note?: string },
) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const label = input.label.trim() || "Novo campo";
  product.attributes.push({
    key: `custom-${++counter}`,
    label,
    value: "",
    required: input.required,
    group: "personalizados",
    custom: true,
    note: input.note?.trim() || undefined,
  });
  if (input.required && product.status === "approved") {
    product.status = "needs_you";
  }
  product.updatedAt = nowLabel();
  sendNotificationEvent({
    companyId: product.companyId,
    kind: "pending",
    title: "Novo campo solicitado",
    description: `O despachante solicitou a informação “${label}” em ${product.name}.`,
    productId,
  });
  playUISound("notification");
  emit();
}

export function removeCustomField(productId: string, key: string) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const index = product.attributes.findIndex((a) => a.key === key);
  if (index !== -1) product.attributes.splice(index, 1);
  emit();
}

export function notificationGlyph(kind: NotificationKind): string {
  switch (kind) {
    case "correction":
      return "alert";
    case "approved":
      return "check";
    case "pending":
      return "file";
    case "invite":
      return "people";
    case "request":
      return "download";
  }
}
