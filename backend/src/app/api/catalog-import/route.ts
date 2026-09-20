import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { importCatalog, CatalogImportError } from "@/modules/catalogImport/catalogImport.service";
import { importCatalogSchema } from "@/modules/catalogImport/catalogImport.schemas";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const parsed = importCatalogSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Revise os registros da planilha.", issues: parsed.error.issues }, { status: 422 });
    return Response.json(await importCatalog(parsed.data, userId), { status: 201 });
  } catch (error) {
    if (error instanceof CatalogImportError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
    return jsonError(error);
  }
}
