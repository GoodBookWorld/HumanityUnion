import { NextResponse } from "next/server";

import { handleRfc8058BlogUnsubscribe } from "../../../../features/blog/blog-subscribe-unsubscribe-one-click";

export const runtime = "nodejs";

/**
 * Internal same-origin adapter for RFC 8058 one-click unsubscribe.
 * Public MUAs POST to `/blog/subscribe/unsubscribe?token=...` (rewritten here by proxy).
 * GET continues to hit the App Router page unchanged.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawBody = await request.text();
  const result = await handleRfc8058BlogUnsubscribe({
    contentType: request.headers.get("content-type"),
    rawBody,
    searchParams: url.searchParams,
  });

  return new NextResponse(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    },
  });
}
