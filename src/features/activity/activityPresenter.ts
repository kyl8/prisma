import type { ActivityDTO } from "./activityTypes";

export function presentActivity(activity: ActivityDTO, viewerId?: string) {
  const own = activity.actor?.id === viewerId;
  const actor = own ? "Você" : activity.actor?.name ?? "Sistema";
  const product = activity.product?.name;
  const metadata = activity.metadata ?? {};
  const field = typeof metadata.fieldLabel === "string" ? metadata.fieldLabel : null;
  const inconsistencyCount = typeof metadata.count === "number" ? metadata.count : null;
  const fileName = typeof metadata.fileName === "string" ? metadata.fileName : null;
  switch (activity.type) {
    case "PRODUCT_APPROVED": return { title: `${actor} aprovou`, subtitle: product ?? "Produto" };
    case "PRODUCT_UPDATED": return { title: `${actor} atualizou`, subtitle: [field, product].filter(Boolean).join(" · ") || "Produto" };
    case "PRODUCT_SUBMITTED": return { title: `${actor} enviou para revisão`, subtitle: product ?? "Produto" };
    case "REQUEST_CREATED": return { title: `${actor} solicitou informações`, subtitle: activity.company.name };
    case "REQUEST_STARTED": return { title: `${actor} iniciou o preenchimento`, subtitle: activity.company.name };
    case "REQUEST_SUBMITTED": return { title: `${actor} enviou informações`, subtitle: activity.company.name };
    case "CORRECTION_REQUESTED": return { title: `${actor} solicitou correção`, subtitle: [field, product].filter(Boolean).join(" · ") || "Produto" };
    case "CORRECTION_RESOLVED": return { title: `${actor} respondeu à correção`, subtitle: [field, product].filter(Boolean).join(" · ") || "Produto" };
    case "REMINDER_SENT": return { title: `${actor} enviou lembrete`, subtitle: activity.company.name };
    case "CATALOG_IMPORTED": return { title: "Sistema concluiu a importação", subtitle: activity.company.name };
    case "CATALOG_INCONSISTENCY_FOUND": return { title: `Sistema encontrou ${inconsistencyCount ?? ""} inconsistências`.replace("  ", " "), subtitle: fileName ?? activity.company.name };
  }
}
