/**
 * Membership public preview + Member Badge offer — WEB_UI (membershipPublic) wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function readNested(root: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = root;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const CATALOG_KEYS = [
  "membershipPublic.publicPreview.captionActiveWithNumber",
  "membershipPublic.publicPreview.captionActivePrivateNumber",
  "membershipPublic.publicPreview.captionPreview",
  "membershipPublic.publicPreview.statusLabel",
  "membershipPublic.publicPreview.ariaLabel",
  "membershipPublic.badgeProduct.title",
  "membershipPublic.badgeProduct.body",
  "membershipPublic.badgeProduct.productName",
  "membershipPublic.badgeProduct.ctaLabel",
  "membershipPublic.badgeProduct.deliveryIncluded",
  "membershipPublic.badgeProduct.membersOnly",
  "membershipPublic.badgeApplication.widgetTitle",
  "membershipPublic.badgeApplication.paymentStatus.paid",
  "membershipPublic.badgeApplication.fulfillmentStatus.shipped",
  "membershipPublic.badgeApplication.saveForLater",
  "membershipPublic.badgeApplication.continueToPayment",
] as const;

describe("Membership public preview + badge offer localization", () => {
  it("MembershipPublicDisplayPreview wires membershipPublic; no audited English captions", () => {
    const preview = readWeb(
      "features/membership/components/MembershipPublicDisplayPreview.tsx",
    );

    assert.match(preview, /useTranslations\("membershipPublic"\)/);
    assert.match(preview, /publicPreview\.captionActiveWithNumber/);
    assert.match(preview, /publicPreview\.captionActivePrivateNumber/);
    assert.match(preview, /publicPreview\.captionPreview/);
    assert.match(preview, /status\.memberCohort/);
    assert.match(preview, /status\.memberNumber/);
    assert.match(preview, /publicPreview\.ariaLabel/);

    assert.doesNotMatch(
      preview,
      /Public profile: Member status appears automatically, including your Member Number/,
    );
    assert.doesNotMatch(
      preview,
      /Your Member Number stays private until you enable it/,
    );
    assert.doesNotMatch(preview, /Public profile preview \(future Member status\)/);
    assert.doesNotMatch(preview, /Public Membership status preview/);
    assert.doesNotMatch(preview, /label:\s*"Status"/);
    assert.doesNotMatch(preview, /value:\s*"Member"/);
    assert.doesNotMatch(preview, /label:\s*"Member Number"/);

    const indicator = readWeb(
      "features/member-profile/components/MemberStatusIndicator.tsx",
    );
    assert.match(indicator, /useTranslations\("membershipPublic"\)/);
    assert.match(indicator, /status\.memberCohort/);
  });

  it("Membership success chrome uses membershipPublic.successPage + siteName", () => {
    const success = readWeb(
      "features/membership/components/MembershipSuccessPageContent.tsx",
    );
    const hero = readWeb("features/membership/components/MembershipSuccessHero.tsx");
    assert.match(success, /membershipPublic\.successPage/);
    assert.match(success, /useLocalizedBrand/);
    assert.doesNotMatch(success, /Thank you for supporting Humanity Union/);
    assert.match(hero, /membershipPublic\.successPage/);
    assert.match(hero, /siteName:\s*brand\.siteName/);
  });

  it("badge offer/widget/modal use membershipPublic + siteName; keep CA$28 constant", () => {
    const offer = readWeb(
      "features/membership/components/MembershipMemberBadgeOffer.tsx",
    );
    const widget = readWeb(
      "features/membership/components/MemberBadgeApplicationWidget.tsx",
    );
    const modal = readWeb(
      "features/membership/components/MemberBadgeApplicationModal.tsx",
    );

    assert.match(offer, /useTranslations\("membershipPublic"\)/);
    assert.match(offer, /useLocalizedBrand\(\)/);
    assert.match(offer, /badgeProduct\.title/);
    assert.match(offer, /badgeProduct\.body/);
    assert.match(offer, /siteName:\s*brand\.siteName/);
    assert.match(offer, /MEMBER_BADGE_APPLICATION_PRICE_LABEL/);
    assert.match(offer, /MEMBER_BADGE_FEATURE_IDS/);
    assert.doesNotMatch(offer, /MEMBER_BADGE_PRODUCT/);
    assert.doesNotMatch(offer, /Wear Your Commitment/);
    assert.doesNotMatch(offer, /Humanity Union Member Badge/);

    assert.match(widget, /useTranslations\("membershipPublic"\)/);
    assert.match(widget, /badgeApplication\.widgetTitle/);
    assert.match(widget, /badgeApplication\.paymentStatus\./);
    assert.match(widget, /badgeApplication\.fulfillmentStatus\./);
    assert.match(widget, /MEMBER_BADGE_APPLICATION_PRICE_LABEL/);
    assert.doesNotMatch(widget, /My Member Badge Application/);
    assert.doesNotMatch(widget, /"Not paid"/);
    assert.doesNotMatch(widget, /"Awaiting payment"/);
    assert.doesNotMatch(widget, /"Shipped"/);

    assert.match(modal, /useTranslations\("membershipPublic"\)/);
    assert.match(modal, /useLocalizedBrand\(\)/);
    assert.match(modal, /badgeApplication\.title/);
    assert.match(modal, /badgeProduct\.applicationIntro/);
    assert.match(modal, /badgeApplication\.saveForLater/);
    assert.match(modal, /badgeApplication\.continueToPayment/);
    assert.match(modal, /MEMBER_BADGE_APPLICATION_PRICE_LABEL/);
    assert.doesNotMatch(modal, /MEMBER_BADGE_PRODUCT/);
    assert.doesNotMatch(modal, /"Save for Later"/);
    assert.doesNotMatch(modal, /"Continue to Payment"/);
  });

  it("publicPreview / badgeProduct / badgeApplication keys exist across locale catalogs", () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      for (const key of CATALOG_KEYS) {
        assert.equal(typeof readNested(catalog, key), "string", `${locale}:${key}`);
      }
    }

    const enBody = readNested(messages("en"), "membershipPublic.badgeProduct.body");
    assert.match(enBody, /\{siteName\}/);
    assert.match(enBody, /CA\$28/);

    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      assert.notEqual(
        readNested(messages(locale), "membershipPublic.badgeProduct.title"),
        readNested(messages("en"), "membershipPublic.badgeProduct.title"),
      );
      assert.notEqual(
        readNested(messages(locale), "membershipPublic.publicPreview.statusLabel"),
        readNested(messages("en"), "membershipPublic.publicPreview.statusLabel"),
      );
    }
  });

  it("dedicated /membership/member-badge page uses membershipPublic.badgePages; no MEMBER_BADGE_PAGE_COPY", () => {
    const page = readWeb(
      "features/membership/components/MemberBadgePageContent.tsx",
    );
    assert.match(page, /membershipPublic\.badgePages/);
    assert.match(page, /useLocalizedBrand/);
    assert.match(page, /heroTitle/);
    assert.match(page, /contributionStatus\./);
    assert.match(page, /requestFulfillmentStatus\./);
    assert.match(page, /faq\.\$\{id\}\.question/);
    assert.doesNotMatch(page, /MEMBER_BADGE_PAGE_COPY/);
    assert.doesNotMatch(page, /MEMBER_BADGE_FAQ/);
    assert.doesNotMatch(page, /formatMemberBadgeContributionStatus/);
    assert.doesNotMatch(page, /Official Humanity Union Member Badge/);
    assert.doesNotMatch(page, /Coming Soon/);
    assert.doesNotMatch(page, /Request Member Badge/);

    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      assert.equal(
        typeof readNested(catalog, "membershipPublic.badgePages.heroTitle"),
        "string",
        `${locale}:heroTitle`,
      );
      assert.match(
        readNested(catalog, "membershipPublic.badgePages.heroTitle"),
        /\{siteName\}/,
      );
      assert.equal(
        typeof readNested(catalog, "membershipPublic.badgePages.contributionStatus.contribution_confirmed"),
        "string",
      );
      assert.equal(
        typeof readNested(catalog, "membershipPublic.badgePages.requestFulfillmentStatus.shipped"),
        "string",
      );
    }
  });
});
