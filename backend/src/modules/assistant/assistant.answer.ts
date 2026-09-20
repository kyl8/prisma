type CatalogProduct = {
  name: string;
  code?: string | null;
  ncm?: string | null;
  status?: string | null;
  completeness?: string | null;
};

export type AssistantCatalogContext = {
  company: { name: string };
  selectedProduct?: CatalogProduct | null;
  products: CatalogProduct[];
  openRequests?: Array<{ status?: string | null }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requestedLimit(message: string) {
  const match = normalize(message).match(/(?:top|ranking)\s*(\d{1,2})?/);
  return Math.min(Math.max(Number(match?.[1] ?? 10), 1), 20);
}

function ncmRankingAnswer(message: string, context: AssistantCatalogContext) {
  const counts = new Map<string, { count: number; products: string[] }>();
  for (const product of context.products) {
    const ncm = product.ncm?.trim();
    if (!ncm) continue;
    const current = counts.get(ncm) ?? { count: 0, products: [] };
    current.count += 1;
    current.products.push(product.name);
    counts.set(ncm, current);
  }

  const ranking = [...counts.entries()]
    .sort(([aNcm, a], [bNcm, b]) => b.count - a.count || aNcm.localeCompare(bNcm, "pt-BR"))
    .slice(0, requestedLimit(message));

  if (!ranking.length) {
    return `O catálogo de ${context.company.name} não possui NCMs cadastradas. Não tenho uma base de mercado conectada para inventar um ranking externo.`;
  }

  const lines = ranking.map(
    ([ncm, item], index) =>
      `${index + 1}. ${ncm} — ${item.count} produto${item.count === 1 ? "" : "s"}: ${item.products.slice(0, 3).join(", ")}`,
  );
  const scope = ranking.length < requestedLimit(message)
    ? `Há somente ${ranking.length} NCM${ranking.length === 1 ? "" : "s"} distinta${ranking.length === 1 ? "" : "s"} neste catálogo.`
    : `Ranking limitado às ${ranking.length} NCMs mais frequentes neste catálogo.`;

  return [`Com base apenas nos produtos cadastrados em ${context.company.name}:`, ...lines, scope, "Isso não é um ranking do mercado brasileiro; faltam dados externos de importação para essa conclusão."].join("\n");
}

function pendingAnswer(context: AssistantCatalogContext) {
  const pending = context.products.filter((product) => {
    const completeness = Number.parseFloat(String(product.completeness ?? "").replace("%", ""));
    const status = normalize(product.status ?? "");
    return (Number.isFinite(completeness) && completeness < 100) || /pendent|analise|needs/.test(status);
  });

  if (!pending.length) return `Não encontrei produtos incompletos ou pendentes no catálogo de ${context.company.name}.`;
  const lines = pending.slice(0, 10).map((product) => `- ${product.name} (${product.completeness || "completude não informada"}; ${product.status || "status não informado"})`);
  return [`Encontrei ${pending.length} produto${pending.length === 1 ? "" : "s"} que precisa${pending.length === 1 ? "" : "m"} de atenção:`, ...lines].join("\n");
}

export function answerFromCatalog(message: string, context: AssistantCatalogContext) {
  const question = normalize(message);
  if (/ncm/.test(question) && /top\s*\d*|ranking|mais (?:usad|frequent|comum)/.test(question)) {
    return ncmRankingAnswer(message, context);
  }
  if (/falt|pendent|incomplet|correc|precisam? de atencao/.test(question)) {
    return pendingAnswer(context);
  }
  return "";
}

export function catalogScopeAnswer(context: AssistantCatalogContext) {
  return `Posso responder com os dados reais do catálogo de ${context.company.name}, que tem ${context.products.length} produto${context.products.length === 1 ? "" : "s"}. Para dados de mercado, rankings nacionais ou classificação fiscal conclusiva, é necessário conectar uma fonte externa apropriada.`;
}
