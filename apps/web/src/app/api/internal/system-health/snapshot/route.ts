import { readConfiguredSystemHealthToken, systemHealthTokenMatches, WEB_SYSTEM_HEALTH_TOKEN_HEADER } from "../../../../../lib/system-health/system-health-token";
import { readWebProcessMemorySnapshot } from "../../../../../lib/system-health/web-process-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal bridge for the API Admin System Health route.
 * The API checks the admin actor before it calls this route.
 * This process cannot see the API host-only session cookie, so the bridge
 * stays closed unless WEB_SYSTEM_HEALTH_TOKEN is configured.
 */
export async function GET(request: Request): Promise<Response> {
  const configured = readConfiguredSystemHealthToken();
  const presented = request.headers.get(WEB_SYSTEM_HEALTH_TOKEN_HEADER);
  if (!configured || !systemHealthTokenMatches(presented)) {
    return new Response(null, {
      status: configured ? 401 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(readWebProcessMemorySnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
