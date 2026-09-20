import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(180),
  type: z.enum(["text", "number", "date", "boolean"]).default("text"),
  value: z.string().max(5000).default(""),
});

export const importCatalogSchema = z.object({
  companyId: z.string().min(1),
  rows: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    code: z.string().trim().min(1).max(120),
    ncm: z.string().trim().min(1).max(30),
    fields: z.array(fieldSchema).max(100),
  })).min(1).max(2000),
});

export type ImportCatalogInput = z.infer<typeof importCatalogSchema>;
