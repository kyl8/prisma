import { getLogcomexStatus } from "@/modules/integration/logcomex.client";

export async function GET() {
  return Response.json({ integration: "logcomex", ...getLogcomexStatus() });
}
