import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assessSsoGrant,
  browserUrlWithoutGrant,
  completeSsoGrantOnce,
  holdSsoGrant,
  interpretSsoCompletion,
  PENDING_SSO_DESTINATION,
  resetSsoCompletionForTests,
  SSO_COMPLETE_PATH,
  ssoGrantMessage,
  VERIFIED_SSO_DESTINATION,
} from "./sso-completion.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const GRANT = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const API_ORIGIN = "https://api-staging.huws.org";

afterEach(() => {
  resetSsoCompletionForTests();
});

describe("Integrity Media SSO completion", () => {
  it("completes a verified account once and sends credentials", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const result = await completeSsoGrantOnce(GRANT, {
      apiBaseUrl: API_ORIGIN,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
          success: true,
          data: { authenticationComplete: true, destination: "/workspace" },
          meta: {},
          links: {},
          message: "Integrity Media sign-in completed.",
        });
      },
    });

    assert.deepEqual(result, { kind: "verified", destination: VERIFIED_SSO_DESTINATION });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, `${API_ORIGIN}${SSO_COMPLETE_PATH}`);
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.referrerPolicy, "no-referrer");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ grant: GRANT }));
    assert.equal(String(calls[0]?.init?.body).includes("accessToken"), false);
  });

  it("follows pending email confirmation to the existing confirmation page", async () => {
    const result = await completeSsoGrantOnce(GRANT, {
      apiBaseUrl: API_ORIGIN,
      fetchImpl: async () =>
        jsonResponse({
          success: true,
          data: {
            emailConfirmationRequired: true,
            emailSent: true,
            maskedEmail: "a***@example.com",
            resendAvailableAt: null,
            destination: "/confirm-email",
          },
          meta: {},
          links: {},
          message: "Email confirmation required.",
        }),
    });

    assert.deepEqual(result, { kind: "pending", destination: PENDING_SSO_DESTINATION });
    assert.equal(JSON.stringify(result).includes("a***@example.com"), false);
  });

  it("rejects a missing or malformed grant before any request", async () => {
    assert.deepEqual(assessSsoGrant(null), { ok: false, reason: "missing" });
    assert.deepEqual(assessSsoGrant("  "), { ok: false, reason: "missing" });
    assert.deepEqual(assessSsoGrant("short"), { ok: false, reason: "malformed" });
    assert.deepEqual(assessSsoGrant(`${GRANT}extra`), { ok: false, reason: "malformed" });
    assert.equal(ssoGrantMessage("missing").includes(GRANT), false);
    assert.equal(ssoGrantMessage("malformed").includes("short"), false);

    let called = false;
    const malformed = assessSsoGrant("not a grant");
    if (malformed.ok) {
      called = true;
      await completeSsoGrantOnce(malformed.grant, {
        apiBaseUrl: API_ORIGIN,
        fetchImpl: async () => {
          called = true;
          return jsonResponse({});
        },
      });
    }

    assert.equal(called, false);
  });

  it("reports an expired or consumed grant without repeating the grant", async () => {
    const expired = await completeWithCode(409, "grant_expired");
    assert.equal(expired.kind, "error");
    if (expired.kind === "error") {
      assert.match(expired.message, /expired/);
      assert.equal(expired.message.includes(GRANT), false);
    }

    resetSsoCompletionForTests();
    const consumed = await completeWithCode(409, "grant_consumed");
    assert.equal(consumed.kind, "error");
    if (consumed.kind === "error") {
      assert.match(consumed.message, /already used/);
      assert.equal(consumed.message.includes(GRANT), false);
    }
  });

  it("keeps a second effect on the same grant from sending another request", async () => {
    let calls = 0;
    const options = {
      apiBaseUrl: API_ORIGIN,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({
          success: true,
          data: { authenticationComplete: true, destination: "/workspace" },
        });
      },
    };

    const first = completeSsoGrantOnce(GRANT, options);
    const second = completeSsoGrantOnce(GRANT, options);
    assert.equal(first, second);
    await first;
    await second;
    assert.equal(calls, 1);
  });

  it("does not retry a failed network request", async () => {
    let calls = 0;
    const options = {
      apiBaseUrl: API_ORIGIN,
      fetchImpl: async () => {
        calls += 1;
        throw new Error("network down");
      },
    };

    const first = await completeSsoGrantOnce(GRANT, options);
    const second = await completeSsoGrantOnce(GRANT, options);
    assert.equal(first.kind, "error");
    assert.equal(second.kind, "error");
    assert.equal(calls, 1);
    if (first.kind === "error") {
      assert.equal(first.message.includes(GRANT), false);
      assert.equal(first.message.includes("network down"), false);
    }
  });

  it("refuses an unsafe redirect destination", () => {
    const unsafe = [
      "https://evil.example/workspace",
      "//evil.example",
      "/\\evil.example",
      "https://staging.huws.org/workspace",
      "/workspace?next=https://evil.example",
      "/confirm-email",
      "/workspace/../confirm-email",
    ];

    for (const destination of unsafe) {
      const result = interpretSsoCompletion({
        success: true,
        data: { authenticationComplete: true, destination },
      });
      assert.equal(result.kind, "error");
      if (result.kind === "error") {
        assert.equal(result.message.includes(destination), false);
      }
    }

    const pendingExternal = interpretSsoCompletion({
      success: true,
      data: { emailConfirmationRequired: true, destination: "https://evil.example/confirm-email" },
    });
    assert.equal(pendingExternal.kind, "error");
  });

  it("removes only the grant from the browser URL and remembers it", () => {
    const cleaned = browserUrlWithoutGrant(
      `https://staging.huws.org/connect/integrity-media/sso?grant=${GRANT}&unused=1#stay`,
    );
    assert.equal(cleaned.includes(GRANT), false);
    assert.equal(cleaned.includes("grant="), false);
    assert.equal(cleaned, "/connect/integrity-media/sso?unused=1#stay");

    assert.deepEqual(holdSsoGrant(GRANT), { ok: true, grant: GRANT });
    assert.deepEqual(holdSsoGrant(null), { ok: true, grant: GRANT });
    assert.deepEqual(holdSsoGrant("short"), { ok: false, reason: "malformed" });
  });

  it("wires the page to one credentialed completion and no stored grant", () => {
    const component = readFileSync(path.join(here, "IntegrityMediaSsoComplete.tsx"), "utf8");
    const page = readFileSync(
      path.join(here, "../../app/connect/integrity-media/sso/page.tsx"),
      "utf8",
    );
    const completion = readFileSync(path.join(here, "sso-completion.ts"), "utf8");

    assert.match(component, /completeSsoGrantOnce/);
    assert.match(component, /stripSsoGrantFromBrowserUrl/);
    assert.match(component, /useLayoutEffect/);
    assert.match(component, /router\.replace\(result\.destination\)/);
    assert.match(completion, /credentials: "include"/);
    assert.match(completion, /referrerPolicy: "no-referrer"/);
    assert.equal(component.includes("apiRequest"), false);
    assert.equal(component.includes("localStorage"), false);
    assert.equal(component.includes("sessionStorage"), false);
    assert.equal(completion.includes("localStorage"), false);
    assert.equal(completion.includes("sessionStorage"), false);
    assert.equal(completion.includes("apiRequest"), false);
    assert.equal(page.includes("grant"), false);
  });
});

async function completeWithCode(status: number, code: string) {
  return completeSsoGrantOnce(GRANT, {
    apiBaseUrl: `${API_ORIGIN}/`,
    fetchImpl: async () =>
      jsonResponse(
        {
          success: false,
          data: null,
          meta: { code },
          links: {},
          message: `raw ${GRANT}`,
        },
        status,
      ),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
