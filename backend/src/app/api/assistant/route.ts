import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { askAssistant } from "@/modules/assistant/assistant.service";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const body = await request.json();
    return Response.json(await askAssistant(userId, { message: String(body.message ?? ""), companyId: body.companyId ? String(body.companyId) : undefined, productId: body.productId ? String(body.productId) : undefined }));
  } catch (error) {
    return jsonError(error);
  }
}
