import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { CatalogProductError, createCatalogProduct } from "@/modules/catalogProduct/catalogProduct.service";
import { createProductSchema } from "@/modules/catalogProduct/catalogProduct.schemas";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const parsed = createProductSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Revise os dados do produto.", issues: parsed.error.issues }, { status: 422 });
    return Response.json(await createCatalogProduct(parsed.data, userId), { status: 201 });
  } catch (error) {
    if (error instanceof CatalogProductError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
    return jsonError(error);
  }
}
