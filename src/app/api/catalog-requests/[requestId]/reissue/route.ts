import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { reissueCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    return Response.json(await reissueCatalogRequest((await params).requestId, userId));
  } catch (error) { return jsonError(error); }
}
