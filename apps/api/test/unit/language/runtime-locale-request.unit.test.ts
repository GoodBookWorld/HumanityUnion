/**
 * Production Completion Pack 02C Task 02 — request locale wiring + document lang/dir.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { Request } from "express";

import {
  attachRuntimeLocale,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  resolveRuntimeLocaleForRequest,
  setLanguageRegistryForceMemoryForTests,
  setRuntimeLocalePreferenceLoaderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

function mockRequest(input: {
  readonly cookies?: Record<string, string>;
  readonly acceptLanguage?: string;
  readonly auth?: { id: string; memberId: string };
}): Request {
  return {
    cookies: input.cookies ?? {},
    headers: {
      "accept-language": input.acceptLanguage,
    },
    auth: input.auth
      ? {
          id: input.auth.id,
          memberId: input.auth.memberId,
          role: "member",
          displayName: "Test",
          email: "test@example.com",
        }
      : undefined,
  } as unknown as Request;
}

describe("Production Completion Pack 02C Task 02 — API request locale wiring", () => {
  beforeEach(() => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
  });

  afterEach(() => {
    setRuntimeLocalePreferenceLoaderForTests(null);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  async function seedAndEnableVerificationLocales(): Promise<void> {
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    await updateLanguageRegistryRecord("lang-zh-Hant", { enabled: true });
    await updateLanguageRegistryRecord("lang-ar", { enabled: true });
  }

  it("anonymous defaults to en with ltr", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocaleForRequest(mockRequest({}));
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.textDirection, "ltr");
  });

  it("cookie precedence for anonymous", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocaleForRequest(
      mockRequest({
        cookies: { hu_lang: "ar" },
        acceptLanguage: "uk,en;q=0.8",
      }),
    );
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.textDirection, "rtl");
    assert.equal(resolved.source, "cookie");
  });

  it("Accept-Language precedence when no cookie", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocaleForRequest(
      mockRequest({ acceptLanguage: "zh-TW,en;q=0.5" }),
    );
    assert.equal(resolved.locale, "zh-Hant");
    assert.equal(resolved.source, "browser");
  });

  it("disabled locale falls through", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocaleForRequest(
      mockRequest({
        cookies: { hu_lang: "uk" },
        acceptLanguage: "uk",
      }),
    );
    assert.equal(resolved.locale, "en");
    assert.notEqual(resolved.source, "cookie");
  });

  it("Participant interfaceLanguage wins when authenticated", async () => {
    await seedAndEnableVerificationLocales();
    setRuntimeLocalePreferenceLoaderForTests(async () => "uk");

    const resolved = await resolveRuntimeLocaleForRequest(
      mockRequest({
        auth: { id: "user-locale-task02", memberId: "participant-locale-task02" },
        cookies: { hu_lang: "ar" },
        acceptLanguage: "zh-Hant",
      }),
    );
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "participant");
  });

  it("attachRuntimeLocale sets req.runtimeLocale", async () => {
    await ensureLanguageRegistrySeeded();
    const req = mockRequest({ cookies: { hu_lang: "en" } });
    const resolved = await attachRuntimeLocale(req);
    assert.equal(req.runtimeLocale?.locale, resolved.locale);
    assert.equal(req.runtimeLocale?.languageId, resolved.languageId);
    assert.equal(req.runtimeLocale?.textDirection, resolved.textDirection);
    assert.equal(req.runtimeLocale?.source, resolved.source);
  });
});
