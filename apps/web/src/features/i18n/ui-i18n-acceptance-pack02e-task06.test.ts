/**
 * Production Completion Pack 02E Task 06 — acceptance + regression close-out.
 *
 * Verifies Tasks 01–05 as one coherent presentation layer on Pack 02D.
 * Does not add translation scope.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
import { resolvePrimaryNavDisplayLabelFromMessages } from "../public-experience/primary-nav-i18n.js";
import { resolveFooterNavDisplayLabel } from "../public-experience/footer-nav-i18n.js";
import { resolveWorkspaceNavDisplayLabelFromMessages } from "../initiatives/components/workspace-nav-i18n.js";
import type { AbstractIntlMessages } from "next-intl";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function footerFromMessages(messages: AbstractIntlMessages) {
  return (key: string) => resolveMergedMessage(messages, "navigation", key) ?? key;
}

describe("Production Completion Pack 02E Task 06 — acceptance close-out", () => {
  it("architecture: Pack 02C locale authority + Pack 02D foundation; no locale routing", () => {
    const layout = readWeb("app/layout.tsx");
    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.match(layout, /NextIntlClientProvider/);
    assert.match(layout, /loadUiMessagesForLocale\(documentLocale\.locale\)/);

    const request = readWeb("i18n/request.ts");
    assert.match(request, /resolveDocumentHtmlLocale/);
    assert.doesNotMatch(request, /createMiddleware|defineRouting|localePrefix/);

    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.doesNotMatch(selector, /document\.documentElement\.(lang|dir)/);
    assert.doesNotMatch(selector, /localePrefix|createMiddleware/);
  });

  it("public chrome + shared + auth + workspace namespaces resolve for verification locales", async () => {
    const locales = ["en", "uk", "zh-Hant", "ar"] as const;
    for (const locale of locales) {
      const pack = await loadUiMessagesForLocale(locale);
      for (const key of [
        "home",
        "institutions",
        "initiatives",
        "support",
        "civicMedia",
        "knowledge",
        "membership",
        "search",
        "blog",
        "civicArchive",
        "privacy",
        "terms",
        "contact",
        "workspace",
      ] as const) {
        assert.ok(resolveMergedMessage(pack.messages, "navigation", key), `${locale}.${key}`);
      }
      assert.ok(resolveMergedMessage(pack.messages, "common", "cancel"));
      assert.ok(resolveMergedMessage(pack.messages, "common", "showPassword"));
      assert.ok(resolveMergedMessage(pack.messages, "a11y", "skipToMainContent"));
      assert.ok(resolveMergedMessage(pack.messages, "auth", "logIn"));
      assert.ok(resolveMergedMessage(pack.messages, "auth", "createAccount"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "profile"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "messages"));
      assert.ok(resolveMergedMessage(pack.messages, "workspace", "account"));
    }

    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolvePrimaryNavDisplayLabelFromMessages("Civic Media", en.messages), "Civic Media");
    assert.equal(resolveFooterNavDisplayLabel("Privacy", footerFromMessages(en.messages)), "Privacy");
    assert.equal(resolveWorkspaceNavDisplayLabelFromMessages("Profile", en.messages), "Profile");
    assert.equal(
      resolveWorkspaceNavDisplayLabelFromMessages("Account Security", en.messages),
      "Account Security",
    );
  });

  it("stable contracts remain identity-driven (routes/ids/Blog navLabel/enums)", () => {
    const primary = readWeb("features/public-experience/constants.ts");
    assert.match(primary, /label: "Civic Media"/);
    assert.match(primary, /CIVIC_MEDIA_ROUTE/);

    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.match(groups, /label: "Profile"/);
    assert.match(groups, /id: "settings"/);
    assert.match(groups, /href: "\/member"/);

    const nav = readWeb("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /label: state\.navLabel/);
    assert.match(nav, /label: "Become an Author"/);
    assert.match(nav, /publishingWorkspaceHref/);

    const account = readWeb("features/auth/components/AccountPanel.tsx");
    assert.match(account, /value: user\.role/);
    assert.match(account, /value: user\.status/);

    const login = readWeb("features/auth/components/LoginForm.tsx");
    assert.match(login, /href="\/register"/);
    assert.match(login, /href="\/password-reset"/);
    assert.match(login, /returnTo/);
  });

  it("scope exclusions: no Pack 02F glossary / lifecycle / Notification Center body extraction", () => {
    assert.equal(existsSync(path.join(webSrc, "features/i18n/glossary")), false);
    assert.equal(existsSync(path.join(webSrc, "features/terminology")), false);

    const groups = readWeb("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.doesNotMatch(groups, /INITIATIVE_LIFECYCLE|Collaborative Analysis/);

    const notifications = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(notifications, /No active notifications/);
    assert.doesNotMatch(notifications, /useTranslations\("workspace"\)/);
  });

  it("catalog parity green; missing-key fixture fails; partial fallback to English", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    const missing = compareCatalogParityToEnglish(
      en.messages,
      {
        navigation: { home: "Головна" },
        auth: { logIn: "Увійти" },
        workspace: { profile: "Профіль" },
      },
      "uk-pack02e-missing-fixture",
    );
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((issue) => issue.path.startsWith("navigation.")));
    assert.ok(missing.issues.some((issue) => issue.path.startsWith("auth.")));
    assert.ok(missing.issues.some((issue) => issue.path.startsWith("workspace.")));

    const partial = {
      async load(locale: string) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled" as const,
          messages: {
            navigation: { home: "Головна" },
            auth: { logIn: "Увійти" },
            workspace: { profile: "Профіль" },
          },
        };
      },
    };
    const merged = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(resolveMergedMessage(merged.messages, "navigation", "home"), "Головна");
    assert.equal(resolveMergedMessage(merged.messages, "navigation", "civicMedia"), "Civic Media");
    assert.equal(resolveMergedMessage(merged.messages, "auth", "logIn"), "Увійти");
    assert.equal(resolveMergedMessage(merged.messages, "auth", "createAccount"), "Create account");
    assert.equal(resolveMergedMessage(merged.messages, "workspace", "profile"), "Профіль");
    assert.equal(resolveMergedMessage(merged.messages, "workspace", "messages"), "Messages");
  });
});
