import { saveProductSchema } from "@/modules/catalogRequest/catalogRequest.schemas";
import { jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { saveCatalogProduct } from "@/modules/catalogRequest/catalogRequest.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string; productId: string }> }) {
  try {
    const parsed = saveProductSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
    const values = await params;
    return Response.json(await saveCatalogProduct(values.token, values.productId, parsed.data));
  } catch (error) { return jsonError(error); }
}
