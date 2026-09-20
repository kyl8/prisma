import type { ActivityType, ActivityVisibility, Prisma } from "@/generated/prisma/client";

export type ActivityMetadata = Prisma.InputJsonValue;

export type RecordActivityInput = {
  companyId: string;
  actorUserId?: string | null;
  type: ActivityType;
  visibility: ActivityVisibility;
  entityType?: string | null;
  entityId?: string | null;
  productId?: string | null;
  requestId?: string | null;
  metadata?: ActivityMetadata;
};

export type ActivityDTO = {
  id: string;
  type: ActivityType;
  visibility: ActivityVisibility;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  metadata: unknown;
  actor: { id: string; name: string | null; role: "DISPATCHER" | "IMPORTER" | "SYSTEM" } | null;
  company: { id: string; name: string };
  product: { id: string; name: string } | null;
  request: { id: string } | null;
};

export const ACTIVITY_CATEGORIES = {
  requests: ["REQUEST_CREATED", "REQUEST_STARTED", "REQUEST_SUBMITTED"],
  products: ["PRODUCT_UPDATED", "PRODUCT_SUBMITTED", "PRODUCT_APPROVED"],
  corrections: ["CORRECTION_REQUESTED", "CORRECTION_RESOLVED"],
  system: ["REMINDER_SENT", "CATALOG_IMPORTED", "CATALOG_INCONSISTENCY_FOUND"],
} as const satisfies Record<string, readonly ActivityType[]>;
