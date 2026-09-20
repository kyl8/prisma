import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ code: "UNAUTHORIZED", message: "Autenticação necessária." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { importer: true, custbrok: true } });
  if (!user) return Response.json({ code: "UNAUTHORIZED", message: "Usuário não encontrado." }, { status: 401 });
  return Response.json({ id: user.id, name: user.name, email: user.email, role: user.importer ? "importer" : user.custbrok ? "dispatcher" : "unknown" });
}
