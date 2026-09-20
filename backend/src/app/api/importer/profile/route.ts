import { authenticatedImporterUserId, importerJsonError } from "@/modules/importer/importer.http";
import { getImporterProfile } from "@/modules/importer/importer.service";
export async function GET(request: Request) { try { const userId = await authenticatedImporterUserId(request); if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 }); return Response.json(await getImporterProfile(userId)); } catch (error) { return importerJsonError(error); } }
