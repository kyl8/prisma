import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { rejectCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    return Response.json(await rejectCatalogRequest((await params).requestId, String(body.note ?? ""), userId));
  } catch (error) { return jsonError(error); }
}
