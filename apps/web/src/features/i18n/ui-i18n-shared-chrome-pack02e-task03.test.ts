/**
 * Production Completion Pack 02E Task 03 — shared common.* + reusable a11y chrome.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "./catalog-parity.js";
import {
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "./load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Production Completion Pack 02E Task 03 — shared common + a11y chrome", () => {
  it("ConfirmDialog default cancel uses common.cancel; caller override preserved", () => {
    const source = readWeb("design-system/components/ConfirmDialog.tsx");
    assert.match(source, /useTranslations\("common"\)/);
    assert.match(source, /tCommon\("cancel"\)/);
    assert.match(source, /resolvedCancelLabel = cancelLabel \?\? tCommon\("cancel"\)/);
    assert.match(source, /onCancel/);
    assert.match(source, /onConfirm/);
    assert.match(source, /role="alertdialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.doesNotMatch(source, /cancelLabel = "Cancel"/);
  });

  it("ApiUnavailableState defaults use common.retry / common.backToHome; overrides preserved", () => {
    const source = readWeb("design-system/components/ApiUnavailableState.tsx");
    assert.match(source, /useTranslations\("common"\)/);
    assert.match(source, /tCommon\("retry"\)/);
    assert.match(source, /tCommon\("backToHome"\)/);
    assert.match(source, /retryLabel \?\? tCommon\("retry"\)/);
    assert.match(source, /homeLabel \?\? tCommon\("backToHome"\)/);
    assert.match(source, /role="alert"/);
    assert.doesNotMatch(source, /retryLabel = "Try again"/);
    assert.doesNotMatch(source, /homeLabel = "Back to Home"/);

    const workspaceOverride = readWeb("components/member/WorkspaceUnavailableContent.tsx");
    assert.match(workspaceOverride, /retryLabel="Retry"/);
    assert.match(workspaceOverride, /homeLabel="Return Home"/);
  });

  it("PasswordInput Show/Hide chrome resolves via common.* keys", () => {
    const source = readWeb("design-system/components/PasswordInput.tsx");
    assert.match(source, /useTranslations\("common"\)/);
    assert.match(source, /tCommon\("showPassword"\)/);
    assert.match(source, /tCommon\("hidePassword"\)/);
    assert.match(source, /tCommon\("show"\)/);
    assert.match(source, /tCommon\("hide"\)/);
    assert.match(source, /aria-pressed=\{visible\}/);
    assert.doesNotMatch(source, /"Show password"|'Show password'/);
    assert.doesNotMatch(source, /\{visible \? "Hide" : "Show"\}/);
  });

  it("global skip-link uses a11y.skipToMainContent", () => {
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(layout, /getTranslations\("a11y"\)/);
    assert.match(layout, /tA11y\("skipToMainContent"\)/);
    assert.match(layout, /href="#main-content"/);
    assert.match(layout, /className="hu-skip-link"/);
    assert.doesNotMatch(layout, />\s*Skip to main content\s*</);
  });

  it("shared default strings resolve for en/uk/zh-Hant/ar", async () => {
    const expected = {
      en: {
        cancel: "Cancel",
        loading: "Loading…",
        error: "Something went wrong.",
        retry: "Try again",
        backToHome: "Back to Home",
        show: "Show",
        hide: "Hide",
        showPassword: "Show password",
        hidePassword: "Hide password",
        skip: "Skip to main content",
      },
      uk: {
        cancel: "Скасувати",
        loading: "Завантаження…",
        error: "Щось пішло не так.",
        retry: "Спробувати знову",
        backToHome: "На головну",
        show: "Показати",
        hide: "Сховати",
        showPassword: "Показати пароль",
        hidePassword: "Сховати пароль",
        skip: "Перейти до основного вмісту",
      },
      "zh-Hant": {
        cancel: "取消",
        loading: "載入中…",
        error: "發生錯誤。",
        retry: "再試一次",
        backToHome: "返回首頁",
        show: "顯示",
        hide: "隱藏",
        showPassword: "顯示密碼",
        hidePassword: "隱藏密碼",
        skip: "跳至主要內容",
      },
      ar: {
        cancel: "إلغاء",
        loading: "جارٍ التحميل…",
        error: "حدث خطأ ما.",
        retry: "حاول مرة أخرى",
        backToHome: "العودة إلى الرئيسية",
        show: "إظهار",
        hide: "إخفاء",
        showPassword: "إظهار كلمة المرور",
        hidePassword: "إخفاء كلمة المرور",
        skip: "التخطي إلى المحتوى الرئيسي",
      },
    } as const;

    for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
      const pack = await loadUiMessagesForLocale(locale);
      const row = expected[locale];
      assert.equal(resolveMergedMessage(pack.messages, "common", "cancel"), row.cancel);
      assert.equal(resolveMergedMessage(pack.messages, "common", "loading"), row.loading);
      assert.equal(resolveMergedMessage(pack.messages, "common", "error"), row.error);
      assert.equal(resolveMergedMessage(pack.messages, "common", "retry"), row.retry);
      assert.equal(resolveMergedMessage(pack.messages, "common", "backToHome"), row.backToHome);
      assert.equal(resolveMergedMessage(pack.messages, "common", "show"), row.show);
      assert.equal(resolveMergedMessage(pack.messages, "common", "hide"), row.hide);
      assert.equal(resolveMergedMessage(pack.messages, "common", "showPassword"), row.showPassword);
      assert.equal(resolveMergedMessage(pack.messages, "common", "hidePassword"), row.hidePassword);
      assert.equal(resolveMergedMessage(pack.messages, "a11y", "skipToMainContent"), row.skip);
    }
  });

  it("verification catalogs pass English-derived parity; missing-key fixture fails", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    const missing = compareCatalogParityToEnglish(
      en.messages,
      {
        common: { cancel: "Скасувати" },
        a11y: { skipToMainContent: "Перейти до основного вмісту" },
      },
      "uk-missing-fixture",
    );
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((issue) => issue.path === "common.retry"));
    assert.ok(missing.issues.some((issue) => issue.path === "common.showPassword"));
    assert.ok(missing.issues.some((issue) => issue.path === "common.loading"));
  });

  it("does not pull auth or workspace shell into this slice", () => {
    const confirm = readWeb("design-system/components/ConfirmDialog.tsx");
    const password = readWeb("design-system/components/PasswordInput.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    for (const source of [confirm, password, layout]) {
      assert.doesNotMatch(source, /useTranslations\("auth"\)/);
      assert.doesNotMatch(source, /useTranslations\("workspace"\)/);
    }
  });
});
