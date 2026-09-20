import { z } from "zod";

export const createCatalogRequestSchema = z.object({
  companyId: z.string().min(1),
  recipientName: z.string().trim().min(2).max(120),
  recipientEmail: z.email(),
  productIds: z.array(z.string().min(1)).min(1).max(500),
  expiresAt: z.coerce.date(),
  message: z.string().trim().max(2000).optional(),
  kind: z.enum(["fill", "correction"]).default("fill"),
  correctionProductId: z.string().optional(),
  correctionFieldKey: z.string().optional(),
  correctionNote: z.string().trim().max(2000).optional(),
});

export const saveProductSchema = z.object({
  attributes: z.record(z.string(), z.string().max(5000)),
});

export const updateCatalogRequestSchema = z.object({
  recipientName: z.string().trim().min(2).max(120).optional(),
  recipientEmail: z.email().optional(),
  expiresAt: z.coerce.date().optional(),
  message: z.string().trim().max(2000).nullable().optional(),
  productIds: z.array(z.string().min(1)).min(1).max(500).optional(),
});

export type CreateCatalogRequestInput = z.infer<typeof createCatalogRequestSchema>;
export type SaveProductInput = z.infer<typeof saveProductSchema>;
export type UpdateCatalogRequestInput = z.infer<typeof updateCatalogRequestSchema>;
