import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { apiRequest } from "../../lib/api-client.js";
import {
  __testOnly_hasRefreshDefinitivelyFailed,
  isAuthRefreshExemptPath,
  refreshAuthSessionOnce,
  resetAuthRefreshState,
} from "./auth-token-refresh.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Auth Recovery Hotfix — bounded refresh / guest settle", () => {
  const originalFetch = globalThis.fetch;
  let calls: { url: string; method: string }[];

  beforeEach(() => {
    calls = [];
    resetAuthRefreshState();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetAuthRefreshState();
  });

  it("1/2 — /auth/me 401 + refresh 401 settles without recursive refresh", async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      calls.push({ url, method });

      if (url.includes("/api/v1/auth/refresh")) {
        return jsonResponse(401, {
          success: false,
          data: null,
          meta: {},
          links: {},
          message: "Authentication required.",
        });
      }

      if (url.includes("/api/v1/auth/me")) {
        return jsonResponse(401, {
          success: false,
          data: null,
          meta: {},
          links: {},
          message: "Authentication required.",
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    await assert.rejects(() => apiRequest("/api/v1/auth/me"), (error: Error) => {
      assert.match(error.message, /Authentication required/i);
      return true;
    });

    const meCalls = calls.filter((c) => c.url.includes("/auth/me"));
    const refreshCalls = calls.filter((c) => c.url.includes("/auth/refresh"));
    assert.equal(meCalls.length, 1, "me attempted once (no retry after failed refresh)");
    assert.equal(refreshCalls.length, 1, "refresh attempted once");
    assert.equal(__testOnly_hasRefreshDefinitivelyFailed(), true);
  });

  it("2 — refresh endpoint 401 never recursively invokes refresh", async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: (init?.method || "GET").toUpperCase() });
      return jsonResponse(401, {
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Authentication required.",
      });
    };

    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/refresh"), true);
    await assert.rejects(() => apiRequest("/api/v1/auth/refresh", { method: "POST" }));
    assert.equal(
      calls.filter((c) => c.url.includes("/auth/refresh")).length,
      1,
      "only the original refresh request",
    );
  });

  it("3/5 — concurrent 401s share one refresh; failed session has one refresh total", async () => {
    let refreshStarts = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      calls.push({ url, method });

      if (url.includes("/api/v1/auth/refresh")) {
        refreshStarts += 1;
        await new Promise((r) => setTimeout(r, 20));
        return jsonResponse(401, {
          success: false,
          data: null,
          meta: {},
          links: {},
          message: "Authentication required.",
        });
      }

      return jsonResponse(401, {
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Authentication required.",
      });
    };

    const results = await Promise.allSettled([
      apiRequest("/api/v1/auth/me"),
      apiRequest("/api/v1/notifications/unread-count"),
      apiRequest("/api/v1/workspace"),
    ]);

    assert.equal(results.every((r) => r.status === "rejected"), true);
    assert.equal(refreshStarts, 1);
    assert.equal(calls.filter((c) => c.url.includes("/auth/refresh")).length, 1);
  });

  it("4 — refresh failure does not dispatch auth-state-changed (source)", () => {
    const refresh = read("features/auth/auth-token-refresh.ts");
    // Success path still dispatches; failure path must not.
    assert.match(refresh, /dispatchAuthStateChanged\(\)/);
    assert.match(refresh, /Do NOT dispatch/);
    assert.match(refresh, /refreshDefinitivelyFailed/);
  });

  it("6 — successful refresh retries original request once", async () => {
    let meCount = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: (init?.method || "GET").toUpperCase() });

      if (url.includes("/api/v1/auth/refresh")) {
        return jsonResponse(200, {
          success: true,
          data: { user: { userId: "u1" } },
          meta: {},
          links: {},
          message: "ok",
        });
      }

      if (url.includes("/api/v1/auth/me")) {
        meCount += 1;
        if (meCount === 1) {
          return jsonResponse(401, {
            success: false,
            data: null,
            meta: {},
            links: {},
            message: "Authentication required.",
          });
        }

        return jsonResponse(200, {
          success: true,
          data: { userId: "u1", email: "a@b.c", displayName: "A" },
          meta: {},
          links: {},
          message: "ok",
        });
      }

      throw new Error(`Unexpected ${url}`);
    };

    const me = await apiRequest<{ userId: string }>("/api/v1/auth/me");
    assert.equal(me.userId, "u1");
    assert.equal(meCount, 2);
    assert.equal(calls.filter((c) => c.url.includes("/auth/refresh")).length, 1);
  });

  it("7 — failed refresh does not retry original request indefinitely", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push({ url, method: "GET" });
      return jsonResponse(401, {
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Authentication required.",
      });
    };

    await assert.rejects(() => apiRequest("/api/v1/auth/me"));
    await assert.rejects(() => apiRequest("/api/v1/auth/me"));

    assert.equal(calls.filter((c) => c.url.includes("/auth/me")).length, 2);
    assert.equal(
      calls.filter((c) => c.url.includes("/auth/refresh")).length,
      1,
      "second me uses failed latch — no second refresh",
    );
  });

  it("8 — useClientAuthStatus settles guest from shared resolver without me chase", () => {
    const status = read("features/auth/use-client-auth-status.ts");
    const resolver = read("features/auth/client-auth-status-resolver.ts");
    assert.match(status, /resolveClientAuthStatus/);
    assert.doesNotMatch(status, /refreshAuthSessionOnce/);
    assert.doesNotMatch(status, /getMe/);
    assert.match(resolver, /refreshAuthSessionOnce\(\{\s*notifyOnSuccess:\s*false\s*\}\)/);
    assert.match(resolver, /markAuthRefreshDefinitivelyFailed/);
    assert.match(resolver, /guestSettled/);
    assert.match(resolver, /no session → session guest → refresh once → fail → guest STOP/);
  });

  it("9 — login after failed refresh resets latch", async () => {
    globalThis.fetch = async () =>
      jsonResponse(401, {
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Authentication required.",
      });

    assert.equal(await refreshAuthSessionOnce(), false);
    assert.equal(__testOnly_hasRefreshDefinitivelyFailed(), true);

    resetAuthRefreshState();
    assert.equal(__testOnly_hasRefreshDefinitivelyFailed(), false);

    const api = read("features/auth/auth-api.ts");
    assert.match(api, /resetAuthRefreshState\(\)/);
    assert.match(api, /acceptBrowserSession/);
  });

  it("10 — logout resets refresh latch and does not auto-refresh (source)", () => {
    const api = read("features/auth/auth-api.ts");
    const refresh = read("features/auth/auth-token-refresh.ts");
    assert.match(api, /logout[\s\S]*resetAuthRefreshState/s);
    assert.match(refresh, /\/api\/v1\/auth\/logout/);
    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/logout"), true);
  });

  it("11/12 — zero-cookie guest path is bounded; no Web Storage auth credentials", async () => {
    const {
      __testOnly_resetClientAuthStatusResolver,
      resolveClientAuthStatus,
    } = await import("./client-auth-status-resolver.js");

    __testOnly_resetClientAuthStatusResolver();
    resetAuthRefreshState();

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: (init?.method || "GET").toUpperCase() });

      if (url.includes("/api/v1/auth/session")) {
        return jsonResponse(200, {
          success: true,
          data: { authenticated: false, user: null, authSource: "none" },
          meta: {},
          links: {},
          message: "Guest session.",
        });
      }

      if (url.includes("/api/v1/auth/refresh")) {
        return jsonResponse(401, {
          success: false,
          data: null,
          meta: { code: "AUTH_REFRESH_TOKEN_REQUIRED" },
          links: {},
          message: "Authentication is required.",
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const first = await Promise.all([
      resolveClientAuthStatus(),
      resolveClientAuthStatus(),
      resolveClientAuthStatus(),
    ]);

    assert.deepEqual(first, ["unauthenticated", "unauthenticated", "unauthenticated"]);
    assert.equal(calls.filter((c) => c.url.includes("/auth/session")).length, 1);
    assert.equal(calls.filter((c) => c.url.includes("/auth/me")).length, 0);
    assert.equal(
      calls.filter((c) => c.url.includes("/auth/refresh")).length,
      1,
      "one refresh after guest session probe",
    );

    // Settled guest must not re-probe on subsequent resolves.
    await resolveClientAuthStatus();
    assert.equal(calls.filter((c) => c.url.includes("/auth/session")).length, 1);
    assert.equal(calls.filter((c) => c.url.includes("/auth/refresh")).length, 1);

    const store = read("features/auth/auth-token-store.ts");
    assert.doesNotMatch(store, /localStorage\.setItem/);
    assert.match(store, /removeItem/);
  });

  it("4b — auth-state invalidation after guest settle does not restart refresh", async () => {
    const {
      __testOnly_resetClientAuthStatusResolver,
      invalidateClientAuthStatusResolution,
      resolveClientAuthStatus,
    } = await import("./client-auth-status-resolver.js");

    __testOnly_resetClientAuthStatusResolver();
    resetAuthRefreshState();

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: (init?.method || "GET").toUpperCase() });

      if (url.includes("/api/v1/auth/session")) {
        return jsonResponse(200, {
          success: true,
          data: { authenticated: false, user: null, authSource: "none" },
          meta: {},
          links: {},
          message: "Guest session.",
        });
      }

      if (url.includes("/api/v1/auth/refresh") || url.includes("/api/v1/auth/me")) {
        return jsonResponse(401, {
          success: false,
          data: null,
          meta: {},
          links: {},
          message: "Authentication required.",
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    assert.equal(await resolveClientAuthStatus(), "unauthenticated");
    const sessionBefore = calls.filter((c) => c.url.includes("/auth/session")).length;
    const refreshBefore = calls.filter((c) => c.url.includes("/auth/refresh")).length;
    assert.equal(refreshBefore, 1);

    // Invalidate without clearing refresh latch (spurious event) — re-probe session,
    // but latch must block another refresh network call.
    invalidateClientAuthStatusResolution();
    assert.equal(await resolveClientAuthStatus(), "unauthenticated");

    assert.equal(
      calls.filter((c) => c.url.includes("/auth/session")).length,
      sessionBefore + 1,
    );
    assert.equal(calls.filter((c) => c.url.includes("/auth/refresh")).length, 1);
    assert.equal(calls.filter((c) => c.url.includes("/auth/me")).length, 0);
    assert.equal(__testOnly_hasRefreshDefinitivelyFailed(), true);
  });

  it("B — expired access + valid refresh authenticates via one refresh", async () => {
    const {
      __testOnly_resetClientAuthStatusResolver,
      resolveClientAuthStatus,
    } = await import("./client-auth-status-resolver.js");

    __testOnly_resetClientAuthStatusResolver();
    resetAuthRefreshState();

    let sessionCalls = 0;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: (init?.method || "GET").toUpperCase() });

      if (url.includes("/api/v1/auth/session")) {
        sessionCalls += 1;
        const authenticated = sessionCalls >= 2;
        return jsonResponse(200, {
          success: true,
          data: authenticated
            ? {
                authenticated: true,
                user: { id: "u1", displayName: "Ada", email: "ada@example.com" },
                authSource: "cookie_or_bearer",
              }
            : { authenticated: false, user: null, authSource: "none" },
          meta: {},
          links: {},
          message: authenticated ? "Authenticated session." : "Guest session.",
        });
      }

      if (url.includes("/api/v1/auth/refresh")) {
        return jsonResponse(200, {
          success: true,
          data: { user: { id: "u1" }, tokens: {} },
          meta: {},
          links: {},
          message: "Refreshed.",
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    assert.equal(await resolveClientAuthStatus(), "authenticated");
    assert.equal(calls.filter((c) => c.url.includes("/auth/session")).length, 2);
    assert.equal(calls.filter((c) => c.url.includes("/auth/refresh")).length, 1);
    assert.equal(calls.filter((c) => c.url.includes("/auth/me")).length, 0);
  });

  it("13 — PWA auth gate uses same client auth status", () => {
    const gate = read("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(gate, /useClientAuthStatus/);
    assert.match(gate, /\/login\?returnTo=/);
  });

  it("refresh exclusion covers bootstrap auth routes", () => {
    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/refresh"), true);
    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/login"), true);
    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/session"), true);
    assert.equal(isAuthRefreshExemptPath("/api/v1/auth/me"), false);
  });
});
