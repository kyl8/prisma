import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { CatalogProductError, deleteCatalogProduct } from "@/modules/catalogProduct/catalogProduct.service";

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "AutenticaÃ§Ã£o necessÃ¡ria." }, { status: 401 });
    const { productId } = await params;
    return Response.json(await deleteCatalogProduct(productId, userId));
  } catch (error) {
    if (error instanceof CatalogProductError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
    return jsonError(error);
  }
}
