import { jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { submitCatalogRequest } from "@/modules/catalogRequest/catalogRequest.service";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try { return Response.json(await submitCatalogRequest((await params).token)); }
  catch (error) { return jsonError(error); }
}
