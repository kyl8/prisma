import { activityJsonError, authenticatedActivityUserId } from "@/modules/activity/activity.http";
import { listActivitiesSchema } from "@/modules/activity/activity.schemas";
import { activityFilterOptions, listActivities } from "@/modules/activity/activity.service";
import { ACTIVITY_CATEGORIES } from "@/modules/activity/activity.types";

export async function GET(request: Request) {
  try {
    const userId = await authenticatedActivityUserId(request);
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const url = new URL(request.url);
    const parsed = listActivitiesSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Filtros inválidos.", issues: parsed.error.issues }, { status: 422 });
    const input = parsed.data;
    if (input.filters === "true") return Response.json(await activityFilterOptions(userId, input.companyId));
    const category = input.category as keyof typeof ACTIVITY_CATEGORIES | undefined;
    const types = input.type ? [input.type] : category ? [...ACTIVITY_CATEGORIES[category]] : undefined;
    return Response.json(await listActivities(userId, { ...input, types }));
  } catch (error) { return activityJsonError(error); }
}
