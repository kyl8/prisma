import { auth } from "@/lib/auth";
import { authenticatedUserId, jsonError } from "@/modules/catalogRequest/catalogRequest.http";
import { createWorkspaceCompany, listWorkspaceCompanies } from "@/modules/catalogRequest/catalogRequest.service";
import { z } from "zod";

const createSchema = z.object({ enterprise: z.string().trim().min(2).max(180), cnpj: z.string().trim().min(14).max(24), name: z.string().trim().min(2).max(120), email: z.email() });

export async function GET(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    return Response.json(await listWorkspaceCompanies(userId));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId(request, await auth());
    if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ code: "INVALID_INPUT", message: "Revise os dados do cliente.", issues: parsed.error.issues }, { status: 422 });
    return Response.json(await createWorkspaceCompany(parsed.data, userId), { status: 201 });
  } catch (error) { return jsonError(error); }
}
