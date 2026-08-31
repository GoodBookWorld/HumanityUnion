/**
 * Production Completion Pack 02E Task 02 — remaining public chrome navigation keys.
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
import { resolveCurrentDestination } from "../../design-system/components/resolve-current-destination.js";
import {
  DESKTOP_CAPSULE_NAVIGATION,
  PRIMARY_NAVIGATION,
} from "../public-experience/constants.js";
import {
  FOOTER_LEGAL_LINKS,
  FOOTER_PLATFORM_COLUMN_ONE,
  FOOTER_PLATFORM_COLUMN_TWO,
} from "../public-experience/footer-links.js";
import {
  FOOTER_FOUNDATION_MESSAGE_KEYS,
  resolveFooterNavDisplayLabel,
} from "../public-experience/footer-nav-i18n.js";
import {
  PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS,
  resolvePrimaryNavDisplayLabel,
  resolvePrimaryNavDisplayLabelFromMessages,
} from "../public-experience/primary-nav-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(here, "../../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function navTranslate(messages: Awaited<ReturnType<typeof loadUiMessagesForLocale>>["messages"]) {
  return (key: string) => resolveMergedMessage(messages, "navigation", key) ?? key;
}

const PRIMARY_TASK02_LABELS = [
  "Civic Media",
  "Knowledge",
  "Membership",
  "Search",
] as const;

const FOOTER_TASK02_LABELS = [
  "Institutions",
  "Initiatives",
  "Blog",
  "Membership",
  "Civic Media",
  "Civic Archive",
  "Search",
  "Privacy",
  "Terms",
  "Contact",
] as const;

describe("Production Completion Pack 02E Task 02 — remaining public chrome navigation", () => {
  it("maps remaining primary-nav destinations to navigation.* keys", () => {
    assert.equal(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS["Civic Media"], "civicMedia");
    assert.equal(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS.Knowledge, "knowledge");
    assert.equal(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS.Membership, "membership");
    assert.equal(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS.Search, "search");

    for (const label of PRIMARY_NAVIGATION.map((item) => item.label)) {
      assert.ok(
        label in PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS,
        `primary nav label "${label}" must have a presentation key`,
      );
    }
  });

  it("desktop and mobile share the same presentation helper contract", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(header, /resolvePrimaryNavDisplayLabel/);
    assert.match(mobile, /resolvePrimaryNavDisplayLabel/);
    assert.match(header, /DESKTOP_CAPSULE_NAVIGATION/);
    assert.match(mobile, /PRIMARY_NAVIGATION/);
  });

  it("translates remaining desktop public nav labels for en/uk/zh-Hant/ar", async () => {
    const packs = {
      en: await loadUiMessagesForLocale("en"),
      uk: await loadUiMessagesForLocale("uk"),
      "zh-Hant": await loadUiMessagesForLocale("zh-Hant"),
      ar: await loadUiMessagesForLocale("ar"),
    } as const;

    const expected = {
      en: {
        "Civic Media": "Civic Media",
        Knowledge: "Knowledge",
        Membership: "Membership",
        Search: "Search",
      },
      uk: {
        "Civic Media": "Громадянські медіа",
        Knowledge: "Знання",
        Membership: "Членство",
        Search: "Пошук",
      },
      "zh-Hant": {
        "Civic Media": "公民媒體",
        Knowledge: "知識",
        Membership: "會籍",
        Search: "搜尋",
      },
      ar: {
        "Civic Media": "الإعلام المدني",
        Knowledge: "المعرفة",
        Membership: "العضوية",
        Search: "البحث",
      },
    } as const;

    for (const locale of Object.keys(expected) as Array<keyof typeof expected>) {
      for (const label of PRIMARY_TASK02_LABELS) {
        assert.equal(
          resolvePrimaryNavDisplayLabelFromMessages(label, packs[locale].messages),
          expected[locale][label],
          `${locale} primary display for ${label}`,
        );
      }
    }

    // Capsule destinations include Knowledge + Search (and foundation Home/…).
    for (const item of DESKTOP_CAPSULE_NAVIGATION) {
      assert.notEqual(
        resolvePrimaryNavDisplayLabel(item.label, navTranslate(packs.uk.messages)),
        `translated:${item.label}`,
      );
      assert.equal(
        typeof resolvePrimaryNavDisplayLabel(item.label, navTranslate(packs.uk.messages)),
        "string",
      );
    }
  });

  it("translates mapped footer labels; hrefs and English identity unchanged", async () => {
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    assert.match(footer, /resolveFooterNavDisplayLabel/);

    for (const label of FOOTER_TASK02_LABELS) {
      assert.ok(
        label in FOOTER_FOUNDATION_MESSAGE_KEYS,
        `footer label "${label}" must be mapped`,
      );
    }

    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolveFooterNavDisplayLabel("Blog", navTranslate(uk.messages)),
      "Блог",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Civic Archive", navTranslate(uk.messages)),
      "Громадянський архів",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Membership", navTranslate(uk.messages)),
      "Членство",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Search", navTranslate(uk.messages)),
      "Пошук",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Privacy", navTranslate(uk.messages)),
      "Конфіденційність",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Terms", navTranslate(uk.messages)),
      "Умови",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Contact", navTranslate(uk.messages)),
      "Контакт",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Institutions", navTranslate(uk.messages)),
      "Інституції",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Initiatives", navTranslate(uk.messages)),
      "Ініціативи",
    );

    assert.deepEqual(
      FOOTER_PLATFORM_COLUMN_ONE.map((link) => ({ label: link.label, href: link.href })),
      [
        { label: "Institutions", href: "/institutions" },
        { label: "Initiatives", href: "/initiatives" },
        { label: "Blog", href: "/blog" },
        { label: "Membership", href: "/membership" },
      ],
    );
    assert.deepEqual(
      FOOTER_PLATFORM_COLUMN_TWO.map((link) => ({ label: link.label, href: link.href })),
      [
        { label: "Civic Media", href: "/media" },
        { label: "Civic Archive", href: "/civic-archive" },
        { label: "Support", href: "/support" },
        { label: "Search", href: "/search" },
      ],
    );
    assert.deepEqual(
      FOOTER_LEGAL_LINKS.map((link) => ({ label: link.label, href: link.href })),
      [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Contact", href: "/contact" },
      ],
    );
  });

  it("preserves stable English identity and active-route matching", () => {
    assert.deepEqual(
      PRIMARY_NAVIGATION.map((item) => ({ label: item.label, href: item.href })),
      [
        { label: "Home", href: "/" },
        { label: "Institutions", href: "/institutions" },
        { label: "Initiatives", href: "/initiatives" },
        { label: "Civic Media", href: "/media" },
        { label: "Knowledge", href: "/knowledge" },
        { label: "Membership", href: "/membership" },
        { label: "Search", href: "/search" },
      ],
    );

    assert.deepEqual(
      DESKTOP_CAPSULE_NAVIGATION.map((item) => item.label),
      ["Home", "Institutions", "Initiatives", "Knowledge", "Search"],
    );

    assert.equal(resolveCurrentDestination("/"), "Home");
    assert.equal(resolveCurrentDestination("/knowledge"), "Knowledge");
    assert.equal(resolveCurrentDestination("/search"), "Search");
    assert.equal(resolveCurrentDestination("/media"), "Civic Media");
    assert.equal(resolveCurrentDestination("/membership"), "Membership");
  });

  it("verification catalogs pass English-derived parity for new navigation keys", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    for (const key of [
      "civicMedia",
      "knowledge",
      "membership",
      "search",
      "blog",
      "civicArchive",
      "privacy",
      "terms",
      "contact",
    ]) {
      assert.equal(typeof resolveMergedMessage(en.messages, "navigation", key), "string");
    }

    const missingFixture = compareCatalogParityToEnglish(
      en.messages,
      { navigation: { home: "Головна" } },
      "uk-missing-fixture",
    );
    assert.equal(missingFixture.ok, false);
    assert.ok(missingFixture.issues.some((issue) => issue.path === "navigation.civicMedia"));
    assert.ok(missingFixture.issues.some((issue) => issue.path === "navigation.search"));
  });

  it("does not introduce locale-prefixed routing", () => {
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    for (const source of [header, mobile, footer]) {
      assert.doesNotMatch(source, /href=\{`\/\$\{.*locale/);
      assert.doesNotMatch(source, /\/\[locale\]/);
    }
  });
});
