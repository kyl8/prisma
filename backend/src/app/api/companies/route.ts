import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { listCompanies } from "@/modules/catalogRequest/catalogRequest.service";

export async function GET(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    return Response.json(await listCompanies(userId));
  } catch (error) { return jsonError(error); }
}
