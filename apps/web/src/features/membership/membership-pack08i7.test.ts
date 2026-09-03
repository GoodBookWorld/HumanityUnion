/**
 * Pack 08I.7 — Membership authenticated section catalogs + wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  membershipApplicationStatusLabelKey,
  membershipContributionStatusLabelKey,
} from "./membership-labels.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const PACK08I7_MEMBERSHIP_KEYS = [
  "membershipPublic.status.title",
  "membershipPublic.status.currentStatus",
  "membershipPublic.status.applicationStatus",
  "membershipPublic.status.memberNumber",
  "membershipPublic.status.memberSince",
  "membershipPublic.status.contribution",
  "membershipPublic.status.ariaFacts",
  "membershipPublic.status.memberCohort",
  "membershipPublic.journey.title",
  "membershipPublic.journey.description",
  "membershipPublic.journey.timelineAria",
  "membershipPublic.journey.steps.registration.label",
  "membershipPublic.journey.steps.contribution.detailUpcoming",
  "membershipPublic.journey.steps.member.label",
  "membershipPublic.application.title",
  "membershipPublic.application.description",
  "membershipPublic.application.displayName",
  "membershipPublic.application.countriesLabel",
  "membershipPublic.application.declareMeaning",
  "membershipPublic.application.submit",
  "membershipPublic.contribution.title",
  "membershipPublic.contribution.bodyPrimary",
  "membershipPublic.contribution.cta",
  "membershipPublic.labels.applicationStatus.not_started",
  "membershipPublic.labels.applicationStatus.submitted",
  "membershipPublic.labels.contributionStatus.completed",
  "membershipPublic.labels.contributionStatus.awaiting",
  "membershipPublic.labels.contributionStatus.notYet",
  "membershipPublic.labels.journeySummary",
] as const;

describe("Pack 08I.7 — Membership authenticated UI catalogs", () => {
  it("catalog parity includes Pack 08I.7 membership keys across en/uk/zh-Hant/ar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PACK08I7_MEMBERSHIP_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("status / journey / application / contribution wire membershipPublic + titleIds", () => {
    const status = readWeb("features/membership/components/MembershipStatusCard.tsx");
    const journey = readWeb("features/membership/components/MembershipJourneySection.tsx");
    const application = readWeb("features/membership/components/MembershipApplicationForm.tsx");
    const contribution = readWeb("features/membership/components/MembershipContributionCard.tsx");
    const labels = readWeb("features/membership/membership-labels.ts");
    const header = readWeb("design-system/components/SectionHeader.tsx");

    assert.match(status, /useTranslations\("membershipPublic"\)/);
    assert.match(status, /titleId="membership-status-title"/);
    assert.match(status, /labels\.applicationStatus/);
    assert.match(status, /labels\.contributionStatus/);
    assert.doesNotMatch(status, /title="Membership Status"/);

    assert.match(journey, /useTranslations\("membershipPublic"\)/);
    assert.match(journey, /titleId="membership-journey-title"/);
    assert.match(journey, /t\("journey\.title"\)/);

    const timeline = readWeb("features/membership/components/MembershipTimeline.tsx");
    assert.match(timeline, /useTranslations\("membershipPublic\.journey"\)/);
    assert.match(timeline, /steps\.\$\{step\.id\}\.label/);
    assert.match(timeline, /MEMBERSHIP_CONTRIBUTION_AMOUNT/);

    assert.match(application, /useTranslations\("membershipPublic"\)/);
    assert.match(application, /titleId="membership-application-title"/);
    assert.match(application, /t\("application\.submit"\)/);
    assert.doesNotMatch(application, /Submit Application/);

    assert.match(contribution, /useTranslations\("membershipPublic"\)/);
    assert.match(contribution, /titleId="membership-contribution-title"/);
    assert.match(contribution, /MEMBERSHIP_CONTRIBUTION_AMOUNT/);
    assert.match(contribution, /t\("contribution\.cta"\)/);
    assert.doesNotMatch(contribution, /Become a Member/);

    assert.match(labels, /membershipApplicationStatusLabelKey/);
    assert.match(labels, /membershipContributionStatusLabelKey/);
    assert.match(header, /titleId\?:/);
  });

  it("status label helpers keep semantic codes and map contribution display keys", () => {
    assert.equal(membershipApplicationStatusLabelKey("draft"), "draft");
    assert.equal(membershipApplicationStatusLabelKey("submitted"), "submitted");
    assert.equal(membershipContributionStatusLabelKey("active_member"), "completed");
    assert.equal(membershipContributionStatusLabelKey("pending_payment"), "awaiting");
    assert.equal(membershipContributionStatusLabelKey("not_started"), "notYet");
  });
});
