export type ActivityType =
  | "REQUEST_CREATED" | "REQUEST_STARTED" | "REQUEST_SUBMITTED"
  | "PRODUCT_UPDATED" | "PRODUCT_SUBMITTED" | "PRODUCT_APPROVED"
  | "CORRECTION_REQUESTED" | "CORRECTION_RESOLVED" | "REMINDER_SENT"
  | "CATALOG_IMPORTED" | "CATALOG_INCONSISTENCY_FOUND";

export type ActivityDTO = {
  id: string;
  type: ActivityType;
  visibility: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; name: string | null; role: "DISPATCHER" | "IMPORTER" | "SYSTEM" } | null;
  company: { id: string; name: string };
  product: { id: string; name: string } | null;
  request: { id: string } | null;
};

export type ActivityFilters = { companyId: string; actorId: string; category: string; date: string };
export type ActivityOptions = { companies: { id: string; name: string }[]; actors: { id: string; name: string }[] };
