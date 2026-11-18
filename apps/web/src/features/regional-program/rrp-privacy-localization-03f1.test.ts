/**
 * HU-RRP-03F.1 — Privacy disclosure, consent alignment, universal localization readiness.
 * No legal publication. No feature-flag activation.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_LEGAL_SOURCE_VERSIONS,
  RRP_APPLICATION_CONSENT_VERSION,
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import { isRrpApplicationEntryEnabled } from "./rrp-application-entry.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** `apps/web/src` */
const webSrc = path.resolve(here, "../..");
/** `apps/web` */
const webRoot = path.resolve(webSrc, "..");
/** repository root (`…/hu-rrp-03c-foundation`) */
const repoRoot = path.resolve(webRoot, "../..");
const messagesDir = path.join(webSrc, "features/i18n/messages");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");
const privacyPage = path.join(webSrc, "app/privacy/page.tsx");

/** Installed WEB_UI message locales (matches Registry-backed catalog files). */
const INSTALLED_LOCALES = [
  "en",
  "ar",
  "de",
  "es",
  "fr",
  "he",
  "ka",
  "pt",
  "uk",
  "zh-Hant",
] as const;

const RTL_LOCALES = ["ar", "he"] as const;

function read(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

function loadPackaged(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(packagedDir, `${locale}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

function leafStrings(
  node: unknown,
  prefix = "",
  out: Map<string, string> = new Map(),
): Map<string, string> {
  if (typeof node === "string") {
    if (prefix) out.set(prefix, node);
    return out;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leafStrings(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

describe("HU-RRP-03F.1 Privacy / consent / localization readiness", () => {
  it("bumps canonical Privacy source and RRP consent without destroying prior version ids", () => {
    assert.equal(CANONICAL_LEGAL_SOURCE_VERSIONS.privacy, "privacy-2026-11-v1");
    assert.equal(CANONICAL_LEGAL_SOURCE_VERSIONS.terms, "terms-2026-03-v1");
    assert.equal(RRP_APPLICATION_CONSENT_VERSION, "rrp-application-consent-v2");
    const legalSrc = readFileSync(
      path.join(repoRoot, "packages/types/src/domain/legal-localization.ts"),
      "utf8",
    );
    const consentSrc = readFileSync(
      path.join(repoRoot, "packages/types/src/domain/rrp-application.ts"),
      "utf8",
    );
    assert.match(legalSrc, /privacy-2026-11-v1/);
    assert.match(consentSrc, /rrp-application-consent-v2/);
    assert.match(consentSrc, /no automatic re-consent migration/i);
  });

  it("keeps Legal Localization fail-closed on canonical version mismatch", () => {
    const publicResolver = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/legal-localization/legal-localization.public.ts",
      ),
      "utf8",
    );
    assert.match(publicResolver, /isUsablePublishedLegal/);
    assert.match(
      publicResolver,
      /canonicalSourceVersion === CANONICAL_LEGAL_SOURCE_VERSIONS\[record\.documentType\]/,
    );
    assert.match(publicResolver, /isStaleRelativeToCanonical/);
  });

  it("documents RRP privacy fields and marks draft for legal review", () => {
    const body = readFileSync(privacyPage, "utf8");
    assert.match(body, /data-rrp-privacy-disclosure="draft-requires-legal-review"/);
    assert.match(body, /Regional Representative Program applications/);
    assert.match(body, /Draft for legal review/);
    assert.match(body, /legal first and last name/i);
    assert.match(body, /date of birth/i);
    assert.match(body, /residence/i);
    assert.match(body, /represent/i);
    assert.match(body, /funding model/i);
    assert.match(body, /decision history/i);
    assert.match(body, /Messages capability/i);
    assert.match(body, /Withdrawal ends the active application/i);
    assert.match(body, /not yet fixed by an explicit product or legal/i);
    assert.doesNotMatch(body, /\bguaranteed delivery\b/i);
  });

  it("clarifies platform designation limits near Join, intro, coordinator, and office wording", () => {
    const en = loadMessages("en") as {
      regionalProgramPublic: {
        cta: { joinDisclaimer: string };
        development: { steps: { team: { body: string }; expand: { body: string } } };
        presence: { notice: string };
        principles: { legal: string };
      };
      rrpApplication: {
        intro: string;
        messages: { notAppointment: string; messagesLater: string };
        admin: { disclaimer: { platformOnly: string } };
      };
    };
    assert.match(en.regionalProgramPublic.cta.joinDisclaimer, /legal authority/i);
    assert.match(en.regionalProgramPublic.cta.joinDisclaimer, /administrator permissions/i);
    assert.match(en.regionalProgramPublic.development.steps.team.body, /not a legal appointment/i);
    assert.match(en.regionalProgramPublic.development.steps.expand.body, /regional office/i);
    assert.match(en.regionalProgramPublic.presence.notice, /contract-signing authority/i);
    assert.match(en.regionalProgramPublic.principles.legal, /separate legal appointment/i);
    assert.match(en.rrpApplication.intro, /internal designation only/i);
    assert.match(en.rrpApplication.messages.notAppointment, /contract-signing authority/i);
    assert.match(en.rrpApplication.admin.disclaimer.platformOnly, /separate legal appointment/i);
    assert.match(en.rrpApplication.messages.messagesLater, /existing Messages/i);
    assert.doesNotMatch(
      en.rrpApplication.messages.messagesLater,
      /once administrator messaging for this program is available/i,
    );
    assert.match(en.rrpApplication.messages.messagesLater, /not guaranteed/i);

    const page = read("features/regional-program/components/RegionalProgramPageContent.tsx");
    assert.match(page, /cta\.joinDisclaimer/);
  });

  it("registers rrpApplication and regionalProgramPublic for ordinary WEB_UI discovery", () => {
    assert.equal(isPublicReaderWebUiRequiredPath("regionalProgramPublic.cta.join"), true);
    assert.equal(
      isPublicReaderWebUiRequiredPath("regionalProgramPublic.cta.joinDisclaimer"),
      true,
    );
    assert.equal(isParticipantWebUiRequiredPath("rrpApplication.title"), true);
    assert.equal(isParticipantWebUiRequiredPath("rrpApplication.messages.messagesLater"), true);
    assert.equal(isParticipantWebUiRequiredPath("rrpApplication.admin.disclaimer.platformOnly"), true);

    const scope = readFileSync(
      path.join(repoRoot, "packages/types/src/domain/participant-web-ui-scope.ts"),
      "utf8",
    );
    assert.match(scope, /"rrpApplication\."/);
  });

  it("keeps source keys discoverable for every installed locale without false EN-clone readiness", () => {
    const enLeaves = leafStrings(loadMessages("en"));
    const rrpKeys = [...enLeaves.keys()].filter(
      (k) => k.startsWith("rrpApplication.") || k.startsWith("regionalProgramPublic."),
    );
    assert.ok(rrpKeys.length > 20, "expected substantial RRP key corpus in English source");

    const messageFiles = readdirSync(messagesDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""));
    for (const locale of INSTALLED_LOCALES) {
      assert.ok(messageFiles.includes(locale), `missing messages file for ${locale}`);
      assert.ok(
        readdirSync(packagedDir).includes(`${locale}.json`),
        `missing packaged catalog for ${locale}`,
      );
    }

    const readiness: Record<
      string,
      {
        sourceKeysAvailable: boolean;
        realRegionalProgramTranslations: boolean;
        rrpApplicationPresent: boolean;
        englishFallbackActiveForJoinDisclaimer: boolean;
        rrpApplicationEnglishCloneOverlay: boolean;
      }
    > = {};

    const enJoin = enLeaves.get("regionalProgramPublic.cta.joinDisclaimer")!;
    const enRrpTitle = enLeaves.get("rrpApplication.title")!;

    for (const locale of INSTALLED_LOCALES) {
      const web = leafStrings(loadMessages(locale));
      const packaged = leafStrings(loadPackaged(locale));
      const hasRpp = [...web.keys()].some((k) => k.startsWith("regionalProgramPublic."));
      const hasRrp = [...web.keys()].some((k) => k.startsWith("rrpApplication."));
      const joinLocal = web.get("regionalProgramPublic.cta.joinDisclaimer");
      const rrpTitle = web.get("rrpApplication.title");
      const rppTitle = web.get("regionalProgramPublic.title");
      const realRpp =
        locale === "en"
          ? true
          : Boolean(rppTitle && rppTitle !== enLeaves.get("regionalProgramPublic.title"));

      readiness[locale] = {
        sourceKeysAvailable: true,
        realRegionalProgramTranslations: realRpp,
        rrpApplicationPresent: hasRrp,
        englishFallbackActiveForJoinDisclaimer: locale !== "en" && joinLocal !== enJoin,
        rrpApplicationEnglishCloneOverlay:
          locale !== "en" && hasRrp && rrpTitle === enRrpTitle,
      };

      assert.equal(hasRpp, true, `${locale} must expose regionalProgramPublic for discovery`);
      assert.ok(packaged.size > 0, `${locale} packaged catalog must exist`);
      // Non-en joinDisclaimer may be absent (EN fallback) — never invent a “ready” flag.
      if (locale !== "en") {
        assert.notEqual(
          joinLocal,
          enJoin,
          `${locale} must not claim completed joinDisclaimer translation by EN clone insert`,
        );
      }
    }

    // Explicit matrix assertions used by the 03F.1 report.
    for (const locale of INSTALLED_LOCALES) {
      assert.ok(readiness[locale], `readiness row missing for ${locale}`);
    }
    assert.equal(readiness.en!.rrpApplicationPresent, true);
    assert.equal(readiness.ar!.rrpApplicationEnglishCloneOverlay, true);
    assert.equal(readiness.uk!.rrpApplicationEnglishCloneOverlay, true);
    assert.equal(readiness["zh-Hant"]!.rrpApplicationEnglishCloneOverlay, true);
    assert.equal(readiness.de!.rrpApplicationPresent, false);
    assert.equal(readiness.es!.rrpApplicationPresent, false);
    assert.equal(readiness.fr!.rrpApplicationPresent, false);
    assert.equal(readiness.he!.rrpApplicationPresent, false);
    assert.equal(readiness.ka!.rrpApplicationPresent, false);
    assert.equal(readiness.pt!.rrpApplicationPresent, false);
    for (const locale of INSTALLED_LOCALES) {
      if (locale === "en") continue;
      assert.equal(
        readiness[locale]!.realRegionalProgramTranslations,
        true,
        `${locale} regionalProgramPublic should retain non-English translations`,
      );
    }
  });

  it("keeps RTL verification hooks for ar/he regional program and application chrome", () => {
    const pageCss = read("features/regional-program/regional-program-page.css");
    const widgetCss = read(
      "features/regional-program/components/rrp-application-workspace-widget.css",
    );
    assert.match(pageCss, /text-align:\s*start/);
    assert.match(pageCss, /regional-program-page__join-disclaimer/);
    assert.match(widgetCss, /\[dir="rtl"\]/);
    for (const locale of RTL_LOCALES) {
      const catalog = loadMessages(locale);
      assert.ok(catalog.regionalProgramPublic, `${locale} regionalProgramPublic present`);
    }
  });

  it("leaves the RRP entry feature flag off by default", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    assert.equal(isRrpApplicationEntryEnabled({ NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED: "true" }), true);
  });
});
