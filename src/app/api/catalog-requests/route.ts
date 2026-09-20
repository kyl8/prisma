import { auth } from "@/lib/auth";
import { createCatalogRequestSchema } from "@/modules/catalogRequest/catalogRequest.schemas";
import { createCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const parsed = createCatalogRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
    return Response.json(await createCatalogRequest(parsed.data, userId), { status: 201 });
  } catch (error) { return jsonError(error); }
}
