import { jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { startCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";

export async function PATCH(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return Response.json(await startCatalogRequest((await params).token)); }
  catch (error) { return jsonError(error); }
}
