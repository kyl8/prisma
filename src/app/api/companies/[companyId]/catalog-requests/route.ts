import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { listCatalogRequests } from "@/modules/catalogRequest/catalogRequest.service";

export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const userId = await authenticatedUserId(_request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    return Response.json(await listCatalogRequests((await params).companyId, userId));
  } catch (error) { return jsonError(error); }
}
