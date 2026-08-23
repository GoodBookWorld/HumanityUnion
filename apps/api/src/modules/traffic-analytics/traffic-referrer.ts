import type { TrafficReferrerType } from "@hu/types";

import { resolveConfiguredWebOrigins } from "../../config/web-origins.js";

export interface ClassifiedReferrer {
  referrerType: TrafficReferrerType;
  referrerHost: string | null;
}

function hostnameFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function configuredInternalHosts(): Set<string> {
  const hosts = new Set<string>();

  for (const origin of resolveConfiguredWebOrigins()) {
    const host = hostnameFromUrl(origin);
    if (host) {
      hosts.add(host);
    }
  }

  hosts.add("localhost");
  hosts.add("127.0.0.1");

  return hosts;
}

/**
 * Classify referrer. EXTERNAL stores hostname only (no path/query).
 */
export function classifyTrafficReferrer(referrer: string | undefined | null): ClassifiedReferrer {
  const trimmed = typeof referrer === "string" ? referrer.trim() : "";

  if (!trimmed) {
    return { referrerType: "DIRECT", referrerHost: null };
  }

  const host = hostnameFromUrl(trimmed);

  if (!host) {
    return { referrerType: "DIRECT", referrerHost: null };
  }

  if (configuredInternalHosts().has(host)) {
    return { referrerType: "INTERNAL", referrerHost: null };
  }

  return { referrerType: "EXTERNAL", referrerHost: host.slice(0, 253) };
}
