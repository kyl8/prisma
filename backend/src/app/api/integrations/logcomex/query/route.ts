import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { queryLogcomex } from "@/modules/integration/logcomex.client";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const body = await request.json();
    return Response.json(await queryLogcomex({ ...body, requestedBy: userId }));
  } catch (error) {
    return jsonError(error);
  }
}
