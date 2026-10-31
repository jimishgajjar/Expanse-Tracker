import { z } from "zod";
import { getActiveWorkspace } from "@/lib/workspace";
import { bankDemoEnabled } from "@/lib/bank-demo/config";
import { commandSchema, DemoError } from "@/lib/bank-demo/model";
import { getDemoStore } from "@/lib/bank-demo/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({
  version: z.number().int().nonnegative(),
  command: commandSchema,
});
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

async function owner() {
  if (!bankDemoEnabled()) return null;
  const workspace = await getActiveWorkspace();
  return workspace?.role === "owner" ? workspace : null;
}

export async function GET() {
  if (!bankDemoEnabled()) return fail("Bank demo is disabled.", 404);
  try {
    const workspace = await owner();
    if (!workspace)
      return fail("Only the workspace owner can use this demo.", 403);
    return Response.json(await getDemoStore().read(workspace.id), { headers });
  } catch {
    return fail("Could not load the bank demo. Try again.", 500);
  }
}

export async function POST(request: Request) {
  if (!bankDemoEnabled()) return fail("Bank demo is disabled.", 404);
  // Next's development server can rewrite request.url to localhost even when
  // the browser uses 127.0.0.1. Compare the browser Origin with the actual Host.
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (origin !== `${url.protocol}//${host}`)
    return fail("Invalid request origin.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("Use a JSON request.", 415);
  try {
    const workspace = await owner();
    if (!workspace)
      return fail("Only the workspace owner can use this demo.", 403);
    // Bound streamed bodies as well as Content-Length; never buffer an unbounded payload.
    const reader = request.body?.getReader();
    if (!reader) return fail("Request body is required.", 400);
    let bytes = 0;
    let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return fail("Request too large.", 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const parsed = bodySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fail("Invalid demo action.", 400);
    const state = await getDemoStore().change(
      workspace.id,
      parsed.data.version,
      parsed.data.command,
    );
    return Response.json(state, { headers });
  } catch (error) {
    if (error instanceof DemoError) return fail(error.message, 409);
    if (error instanceof SyntaxError) return fail("Invalid JSON.", 400);
    return fail(
      "Could not save this demo action. Refresh before retrying.",
      500,
    );
  }
}
