import { jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { getPublicCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return Response.json(await getPublicCatalogRequest((await params).token)); }
  catch (error) { return jsonError(error); }
}
