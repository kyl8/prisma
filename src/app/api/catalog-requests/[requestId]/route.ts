import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { cancelCatalogRequest, updateCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";
import { updateCatalogRequestSchema } from "@/modules/catalogRequest/catalogRequest.schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const parsed = updateCatalogRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
    return Response.json(await updateCatalogRequest((await params).requestId, parsed.data, userId));
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    return Response.json(await cancelCatalogRequest((await params).requestId, userId));
  } catch (error) { return jsonError(error); }
}
