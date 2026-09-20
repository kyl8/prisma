import { z } from "zod";
import { auth } from "@/lib/auth";
import { SiscomexError } from "./siscomex.client";
import { SiscomexService } from "./siscomex.service";

export const syncSchema = z.object({
  productCode: z.string().trim().regex(/^\d{1,10}$/),
  version: z.string().trim().max(8).regex(/^\d+(?:\.\d+)*$/),
  force: z.boolean().default(false),
  operationMode: z.enum(["IMPORTACAO", "EXPORTACAO"]).default("IMPORTACAO"),
  foreignOperator: z.object({ code: z.string().trim().regex(/^[A-Za-z0-9._-]{1,35}$/), country: z.string().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()), version: z.string().max(8).regex(/^\d+(?:\.\d+)*$/) }).strict().optional(),
}).strict();

export function siscomexJsonError(error: unknown) {
  if (error instanceof SiscomexError) return Response.json({ code: error.code, message: error.message, retryable: error.retryable }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ code: "INVALID_INPUT", message: "Confira os parâmetros da consulta, o código e a versão do produto." }, { status: 422 });
  console.error("siscomex_error", error instanceof Error ? error.name : "unknown");
  return Response.json({ code: "INTERNAL_ERROR", message: "Não foi possível concluir a consulta. Verifique a conexão e as migrações do banco." }, { status: 500 });
}

export async function handleSiscomex(request: Request, path: string[]) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new SiscomexError("UNAUTHORIZED", "Entre na plataforma para consultar o SISCOMEX.", 401);
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      const allowed = [new URL(request.url).origin, process.env.FRONTEND_ORIGIN, process.env.NEXT_PUBLIC_APP_URL].filter(Boolean);
      if (origin && !allowed.includes(origin)) throw new SiscomexError("FORBIDDEN", "Origem da consulta não autorizada.", 403);
      if (!request.headers.get("content-type")?.includes("application/json")) throw new SiscomexError("INVALID_INPUT", "Envie a consulta em JSON.", 415);
    }
    const service = new SiscomexService();
    let result: unknown;
    if (path.length === 1 && path[0] === "status" && request.method === "GET") result = await service.status(userId);
    else if (path.length === 1 && path[0] === "test" && request.method === "POST") result = await service.testConnection(userId);
    else if (path[0] === "companies" && path.length >= 3) {
      const companyId = z.string().min(1).max(128).parse(path[1]);
      const url = new URL(request.url);
      if (path.length === 3 && ["catalog", "operators"].includes(path[2])) result = await service.catalog(userId, companyId, request.method === "POST", path[2] === "operators");
      else if (path.length === 4 && path[2] === "products") {
        if (request.method === "GET") result = await service.comparison(userId, companyId, path[3]);
        else {
          const body = await request.text();
          if (body.length > 4096) throw new SiscomexError("INVALID_INPUT", "A consulta excedeu o tamanho permitido.", 413);
          result = await service.sync(userId, companyId, path[3], syncSchema.parse(JSON.parse(body)));
        }
      } else if (path.length === 4 && ["ncm", "attributes"].includes(path[2]) && request.method === "GET") {
        const mode = z.enum(["IMPORTACAO", "EXPORTACAO"]).parse(url.searchParams.get("operationMode") || "IMPORTACAO");
        result = await service.lookup(userId, companyId, path[3], path[2] as "ncm" | "attributes", url.searchParams.get("force") === "true", mode);
      } else throw new SiscomexError("NOT_FOUND", "Consulta não encontrada.", 404);
    } else throw new SiscomexError("NOT_FOUND", "Consulta não encontrada.", 404);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return siscomexJsonError(error); }
}
