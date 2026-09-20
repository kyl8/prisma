import { z } from "zod";
import { ACTIVITY_CATEGORIES } from "./activity.types";

const activityTypes = Object.values(ACTIVITY_CATEGORIES).flat();

export const listActivitiesSchema = z.object({
  companyId: z.string().min(1).optional(), actorId: z.string().min(1).optional(), type: z.enum(activityTypes).optional(),
  category: z.enum(["requests", "products", "corrections", "system"]).optional(), order: z.enum(["asc", "desc"]).default("desc"),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30), filters: z.enum(["true", "false"]).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "Período inválido.", path: ["to"] });
