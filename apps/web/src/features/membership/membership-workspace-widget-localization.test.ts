/**
 * Task 01 — Workspace Membership widget WEB_UI consumer (membershipPublic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatMembershipApplicationStatus,
  formatMembershipContributionStatus,
  formatMembershipJourneySummary,
  membershipApplicationStatusLabelKey,
  membershipContributionStatusLabelKey,
  membershipJourneyCompletedCount,
} from "./membership-labels.js";

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

function tMembership(
  catalog: Record<string, unknown>,
): (key: string, values?: Record<string, string | number>) => string {
  const ns = catalog.membershipPublic as Record<string, unknown>;
  return (key, values) => {
    const parts = key.split(".");
    let cur: unknown = ns;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur !== "string") return key;
    if (!values) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
  };
}

describe("MembershipWorkspaceWidget localization (Task 01)", () => {
  it("does not use deprecated English formatters; wires membershipPublic codes", () => {
    const widget = readWeb("features/membership/components/MembershipWorkspaceWidget.tsx");

    assert.match(widget, /useTranslations\("membershipPublic"\)/);
    assert.match(widget, /membershipApplicationStatusLabelKey/);
    assert.match(widget, /membershipContributionStatusLabelKey/);
    assert.match(widget, /membershipJourneyCompletedCount/);
    assert.match(widget, /labels\.journeySummary/);
    assert.match(widget, /displayLabel=\{cohortDisplayLabel\}/);
    assert.match(widget, /workspaceWidget\.continueCta/);

    assert.doesNotMatch(widget, /formatMembershipApplicationStatus/);
    assert.doesNotMatch(widget, /formatMembershipContributionStatus/);
    assert.doesNotMatch(widget, /formatMembershipJourneySummary/);
    assert.doesNotMatch(widget, /Continue Membership/);
    assert.doesNotMatch(widget, /"Not Started"/);
    assert.doesNotMatch(widget, /"Not yet completed"/);
    assert.doesNotMatch(widget, />\{membership\.cohortLabel\}</);
    assert.match(widget, /workspace-home-card__status">\{cohortDisplayLabel\}</);
    assert.doesNotMatch(widget, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(widget, /switch\s*\(\s*locale\s*\)/);
  });

  it("uk fixture resolves status/application/journey/contribution/cohort/CTA via WEB_UI", () => {
    const uk = messages("uk");
    const t = tMembership(uk);

    const applicationKey = membershipApplicationStatusLabelKey("not_started");
    const contributionKey = membershipContributionStatusLabelKey("not_started");
    const timeline = [
      { state: "complete" as const },
      { state: "complete" as const },
      { state: "current" as const },
      { state: "upcoming" as const },
      { state: "upcoming" as const },
    ];
    const completed = membershipJourneyCompletedCount(timeline);

    assert.equal(t("pageTitle"), "Членство");
    assert.equal(t("status.currentStatus"), "Поточний статус");
    assert.equal(t("status.applicationStatus"), "Статус заявки");
    assert.equal(t("workspaceWidget.journey"), "Шлях");
    assert.equal(t("status.contribution"), "Внесок");
    assert.equal(t("status.participantCohort"), "Учасник");
    assert.equal(t("status.memberCohort"), "Член");
    assert.equal(t(`labels.applicationStatus.${applicationKey}`), "Не розпочато");
    assert.equal(t(`labels.contributionStatus.${contributionKey}`), "Ще не завершено");
    assert.equal(t("workspaceWidget.continueCta"), "Продовжити членство");
    assert.equal(t("workspaceWidget.viewSuccessCta"), "Переглянути успіх членства");

    const journey = t("labels.journeySummary", { completed, total: timeline.length });
    assert.equal(journey, "2 з 5 кроків завершено");
    assert.match(journey, /2/);
    assert.match(journey, /5/);

    // Localized values differ from deprecated English formatter output.
    assert.notEqual(
      t(`labels.applicationStatus.${applicationKey}`),
      formatMembershipApplicationStatus("not_started"),
    );
    assert.notEqual(
      t(`labels.contributionStatus.${contributionKey}`),
      formatMembershipContributionStatus("not_started"),
    );
    assert.notEqual(journey, formatMembershipJourneySummary(timeline));
  });

  it("workspaceWidget keys exist with parity across installed locale catalogs", () => {
    const keys = [
      "membershipPublic.workspaceWidget.unavailable",
      "membershipPublic.workspaceWidget.journey",
      "membershipPublic.workspaceWidget.continueCta",
      "membershipPublic.workspaceWidget.viewSuccessCta",
    ] as const;

    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      for (const key of keys) {
        assert.equal(typeof readNested(catalog, key), "string", `${locale}:${key}`);
      }
    }

    const en = tMembership(messages("en"));
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const t = tMembership(messages(locale));
      assert.notEqual(t("workspaceWidget.continueCta"), en("workspaceWidget.continueCta"));
      assert.notEqual(t("workspaceWidget.journey"), en("workspaceWidget.journey"));
    }
  });
});
