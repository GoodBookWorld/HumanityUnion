"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { API_BASE_URL } from "../../lib/api-base-url";

/**
 * Pack 11C — best-effort first-party pageview beacon.
 * Never blocks navigation. Module-level dedupe survives Strict Mode remounts.
 * Uses credentialed fetch (not sendBeacon) so cross-origin HttpOnly cookies work.
 */

const recentNavigations = new Map<string, number>();
const DEDUPE_WINDOW_MS = 2_000;

function shouldRecordNavigation(pathname: string): string | null {
  const now = Date.now();
  const last = recentNavigations.get(pathname);

  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
    return null;
  }

  recentNavigations.set(pathname, now);

  if (recentNavigations.size > 40) {
    for (const [key, at] of recentNavigations) {
      if (now - at > DEDUPE_WINDOW_MS * 5) {
        recentNavigations.delete(key);
      }
    }
  }

  return `nav_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function postPageview(pathname: string, navigationId: string): void {
  const payload = JSON.stringify({
    pathname,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    navigationId,
  });

  const url = `${API_BASE_URL}/api/v1/public/analytics/pageview`;

  void fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics failure must never surface to the user.
  });
}

export function TrafficPageviewCollector() {
  const pathname = usePathname();
  const mountedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    mountedPathRef.current = pathname;
    const navigationId = shouldRecordNavigation(pathname);
    if (!navigationId) {
      return;
    }

    postPageview(pathname, navigationId);
  }, [pathname]);

  return null;
}
