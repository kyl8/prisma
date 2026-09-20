// ============================================================================
// PRISMA — Dados mockados tipados
// ============================================================================
// Todo o conteúdo abaixo é ilustrativo. Em produção, estas coleções viriam
// de uma API com autenticação por perfil e isolamento por companyId.
// ============================================================================

export type UserRole = "dispatcher" | "importer";

export type Company = {
  id: string;
  name: string;
  cnpj: string;
  contactName?: string;
  contactEmail?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Obrigatório para importadores: define a empresa que o usuário enxerga. */
  companyId?: string;
  initials: string;
  title?: string;
};

/** Status simplificados visíveis para o importador. */
export type ImporterProductStatus =
  | "needs_you"
  | "sent_for_review"
  | "correction_requested"
  | "approved";

export type AttributeGroup =
  | "identificacao"
  | "classificacao"
  | "caracteristicas"
  | "personalizados";

export type ProductAttribute = {
  key: string;
  label: string;
  value: string;
  required: boolean;
  group: AttributeGroup;
  /** Campo personalizado criado pelo despachante para pedir informação extra. */
  custom?: boolean;
  note?: string;
};

export type Correction = {
  id: string;
  productId: string;
  fieldKey: string;
  currentValue: string;
  note: string;
  requestedBy: string;
  requestedByTitle: string;
  createdAt: string;
  status: "open" | "resolved";
  resolvedValue?: string;
};

export type Product = {
  id: string;
  companyId: string;
  name: string;
  sku: string;
  ncm: string;
  ncmDescription: string;
  /** Completude calculada pelo catálogo persistido, quando disponível. */
  completeness?: string;
  attributes: ProductAttribute[];
  corrections: Correction[];
  status: ImporterProductStatus;
  updatedAt: string;
};

export type NotificationKind =
  | "correction"
  | "approved"
  | "pending"
  | "invite"
  | "request";

export type AppNotification = {
  id: string;
  companyId: string;
  kind: NotificationKind;
  title: string;
  description: string;
  productId?: string;
  read: boolean;
  createdAt: string;
};

export type CatalogRequest = {
  id: string;
  token: string;
  companyId: string;
  createdByUserId: string;
  recipientName: string;
  recipientEmail: string;
  productIds: string[];
  status: "waiting" | "in_progress" | "submitted" | "completed" | "expired";
  createdAt: string;
  expiresAt: string;
  message?: string;
  kind: "fill" | "correction";
  correctionFieldKey?: string;
  correctionNote?: string;
};

export const companies: Company[] = [
  { id: "atlas", name: "Atlas Importações", cnpj: "12.345.678/0001-90" },
  { id: "ocean", name: "Ocean Trade", cnpj: "32.147.890/0001-12" },
  { id: "brava", name: "Brava Equipamentos", cnpj: "06.551.481/0001-44" },
];

export const users: AppUser[] = [
  {
    id: "u-carlos",
    name: "Carlos Mendes",
    email: "carlos@prisma.com",
    role: "dispatcher",
    initials: "CM",
    title: "Despachante aduaneiro",
  },
  {
    id: "u-mariana",
    name: "Mariana Costa",
    email: "mariana@atlas.com.br",
    role: "importer",
    companyId: "atlas",
    initials: "MC",
  },
  {
    id: "u-ricardo",
    name: "Ricardo Alves",
    email: "ricardo@oceantrade.com.br",
    role: "importer",
    companyId: "ocean",
    initials: "RA",
  },
];

type AttrInput = [key: string, label: string, value: string, required: boolean, group: AttributeGroup];
const attr = (key: string, label: string, value: string, required: boolean, group: AttributeGroup): ProductAttribute => ({
  key,
  label,
  value,
  required,
  group,
});

const motorAttrs = (): AttrInput[] => [
  ["nome", "Nome comercial", "Motor Elétrico XP-200", true, "identificacao"],
  ["codigo", "Código interno", "MTR-0021", true, "identificacao"],
  ["fabricante", "Fabricante", "Volter Tech", false, "identificacao"],
  ["marca", "Marca", "Volter", false, "identificacao"],
  ["modelo", "Modelo", "", false, "identificacao"],
  ["ncm", "NCM", "8501.10.19", true, "classificacao"],
  ["descricao", "Descrição do produto", "Motores elétricos de potência inferior a 37,5 W", true, "classificacao"],
  ["material", "Material", "", true, "caracteristicas"],
  ["potencia", "Potência", "", true, "caracteristicas"],
  ["tensao", "Tensão", "220V", true, "caracteristicas"],
  ["aplicacao", "Aplicação", "", true, "caracteristicas"],
  ["unidade", "Unidade de medida", "Unidade", false, "caracteristicas"],
];

export const initialProducts: Product[] = [
  // ── Atlas Importações ──────────────────────────────────────────────────────
  {
    id: "p-motor",
    companyId: "atlas",
    name: "Motor Elétrico XP-200",
    sku: "MTR-0021",
    ncm: "8501.10.19",
    ncmDescription: "Motores elétricos de potência inferior a 37,5 W",
    attributes: [
      ...motorAttrs().map(([k, l, v, r, g]) => attr(k, l, v, r, g)),
      {
        key: "custom-serie",
        label: "Número de série",
        value: "",
        required: true,
        group: "personalizados",
        custom: true,
        note: "Informe o número de série gravado na placa do motor.",
      },
    ],
    corrections: [],
    status: "needs_you",
    updatedAt: "Hoje",
  },
  {
    id: "p-sensor",
    companyId: "atlas",
    name: "Sensor Industrial A12",
    sku: "SNS-119",
    ncm: "9031.80.99",
    ncmDescription: "Outros aparelhos de medida ou controle",
    attributes: [
      attr("nome", "Nome comercial", "Sensor Industrial A12", true, "identificacao"),
      attr("codigo", "Código interno", "SNS-119", true, "identificacao"),
      attr("fabricante", "Fabricante", "SensoTech", false, "identificacao"),
      attr("marca", "Marca", "SensoTech", false, "identificacao"),
      attr("modelo", "Modelo", "A12", false, "identificacao"),
      attr("ncm", "NCM", "9031.80.99", true, "classificacao"),
      attr("descricao", "Descrição do produto", "Sensor industrial de presença", true, "classificacao"),
      attr("material", "Material", "Aço inox", true, "caracteristicas"),
      attr("potencia", "Potência", "—", true, "caracteristicas"),
      attr("tensao", "Tensão", "24V", true, "caracteristicas"),
      attr("aplicacao", "Aplicação", "Controle industrial", true, "caracteristicas"),
      attr("unidade", "Unidade de medida", "Unidade", false, "caracteristicas"),
    ],
    corrections: [],
    status: "approved",
    updatedAt: "Ontem",
  },
  {
    id: "p-valvula",
    companyId: "atlas",
    name: "Válvula Industrial VX-80",
    sku: "VLV-089",
    ncm: "8481.80.99",
    ncmDescription: "Outros dispositivos para canalizações",
    attributes: [
      attr("nome", "Nome comercial", "Válvula Industrial VX-80", true, "identificacao"),
      attr("codigo", "Código interno", "VLV-089", true, "identificacao"),
      attr("fabricante", "Fabricante", "Valforte", false, "identificacao"),
      attr("marca", "Marca", "Valforte", false, "identificacao"),
      attr("modelo", "Modelo", "VX-80", false, "identificacao"),
      attr("ncm", "NCM", "8481.80.99", true, "classificacao"),
      attr("descricao", "Descrição do produto", "Válvula industrial para canalizações", true, "classificacao"),
      attr("material", "Material", "Aço", true, "caracteristicas"),
      attr("potencia", "Potência", "—", true, "caracteristicas"),
      attr("tensao", "Tensão", "—", true, "caracteristicas"),
      attr("aplicacao", "Aplicação", "", true, "caracteristicas"),
      attr("unidade", "Unidade de medida", "Unidade", false, "caracteristicas"),
    ],
    corrections: [
      {
        id: "cor-1",
        productId: "p-valvula",
        fieldKey: "material",
        currentValue: "Aço",
        note: "Informe o tipo de aço utilizado na fabricação.",
        requestedBy: "Carlos Mendes",
        requestedByTitle: "Despachante",
        createdAt: "Hoje, 14:32",
        status: "open",
      },
    ],
    status: "correction_requested",
    updatedAt: "17 set",
  },
  {
    id: "p-bomba",
    companyId: "atlas",
    name: "Bomba Centrífuga CP-30",
    sku: "BMB-030",
    ncm: "8413.70.90",
    ncmDescription: "Outras bombas centrífugas",
    attributes: motorAttrs()
      .map(([k, l, v, r, g]) =>
        attr(
          k,
          l,
          k === "nome" ? "Bomba Centrífuga CP-30"
          : k === "codigo" ? "BMB-030"
          : k === "modelo" ? "CP-30"
          : k === "ncm" ? "8413.70.90"
          : k === "descricao" ? "Bomba centrífuga para uso industrial"
          : k === "material" ? "Ferro fundido"
          : k === "potencia" ? "7,5 kW"
          : k === "aplicacao" ? "Bombeamento industrial"
          : v,
          r,
          g,
        ),
      ),
    corrections: [],
    status: "sent_for_review",
    updatedAt: "17 set",
  },
  // ── Ocean Trade (segunda empresa para provar o isolamento) ────────────────
  {
    id: "p-bomba-ocean",
    companyId: "ocean",
    name: "Bomba Centrífuga CP-40",
    sku: "CP-4001",
    ncm: "8413.70.90",
    ncmDescription: "Outras bombas centrífugas",
    attributes: [
      attr("nome", "Nome comercial", "Bomba Centrífuga CP-40", true, "identificacao"),
      attr("codigo", "Código interno", "CP-4001", true, "identificacao"),
      attr("fabricante", "Fabricante", "HidroMax", false, "identificacao"),
      attr("marca", "Marca", "HidroMax", false, "identificacao"),
      attr("modelo", "Modelo", "CP-40", false, "identificacao"),
      attr("ncm", "NCM", "8413.70.90", true, "classificacao"),
      attr("descricao", "Descrição do produto", "Bomba centrífuga de média vazão", true, "classificacao"),
      attr("material", "Material", "", true, "caracteristicas"),
      attr("potencia", "Potência", "", true, "caracteristicas"),
      attr("tensao", "Tensão", "380V", true, "caracteristicas"),
      attr("aplicacao", "Aplicação", "", true, "caracteristicas"),
      attr("unidade", "Unidade de medida", "Unidade", false, "caracteristicas"),
    ],
    corrections: [],
    status: "needs_you",
    updatedAt: "16 set",
  },
  {
    id: "p-compressor-ocean",
    companyId: "ocean",
    name: "Compressor de Ar CA-7",
    sku: "CPR-007",
    ncm: "8414.80.19",
    ncmDescription: "Outros compressores de ar",
    attributes: [
      attr("nome", "Nome comercial", "Compressor de Ar CA-7", true, "identificacao"),
      attr("codigo", "Código interno", "CPR-007", true, "identificacao"),
      attr("fabricante", "Fabricante", "AirMax", false, "identificacao"),
      attr("marca", "Marca", "AirMax", false, "identificacao"),
      attr("modelo", "Modelo", "CA-7", false, "identificacao"),
      attr("ncm", "NCM", "8414.80.19", true, "classificacao"),
      attr("descricao", "Descrição do produto", "Compressor de ar industrial", true, "classificacao"),
      attr("material", "Material", "Aço carbono", true, "caracteristicas"),
      attr("potencia", "Potência", "15 kW", true, "caracteristicas"),
      attr("tensao", "Tensão", "380V", true, "caracteristicas"),
      attr("aplicacao", "Aplicação", "Linha de produção", true, "caracteristicas"),
      attr("unidade", "Unidade de medida", "Unidade", false, "caracteristicas"),
    ],
    corrections: [],
    status: "approved",
    updatedAt: "15 set",
  },
];

export const initialNotifications: AppNotification[] = [
  {
    id: "n-1",
    companyId: "atlas",
    kind: "correction",
    title: "Correção solicitada",
    description: "Carlos solicitou uma correção em Válvula Industrial VX-80.",
    productId: "p-valvula",
    read: false,
    createdAt: "Hoje às 14:32",
  },
  {
    id: "n-2",
    companyId: "atlas",
    kind: "approved",
    title: "Produto aprovado",
    description: "Sensor Industrial A12 foi aprovado.",
    productId: "p-sensor",
    read: false,
    createdAt: "Ontem às 16:10",
  },
  {
    id: "n-3",
    companyId: "atlas",
    kind: "pending",
    title: "Informações pendentes",
    description: "Motor Elétrico XP-200 ainda precisa de informações obrigatórias.",
    productId: "p-motor",
    read: false,
    createdAt: "17 set às 09:20",
  },
  {
    id: "n-4",
    companyId: "ocean",
    kind: "pending",
    title: "Informações pendentes",
    description: "Bomba Centrífuga CP-40 precisa de informações obrigatórias.",
    productId: "p-bomba-ocean",
    read: false,
    createdAt: "17 set às 08:00",
  },
];
