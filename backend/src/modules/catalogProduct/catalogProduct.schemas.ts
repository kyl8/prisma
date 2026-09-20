import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(180),
  type: z.enum(["text", "number", "date", "boolean"]).default("text"),
  value: z.string().max(5000).default(""),
  required: z.boolean().default(false),
});

export const createProductSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(1).max(180),
  code: z.string().trim().min(1).max(120),
  ncm: z.string().trim().min(1).max(30),
  fields: z.array(fieldSchema).max(100).default([]),
  submitForReview: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
