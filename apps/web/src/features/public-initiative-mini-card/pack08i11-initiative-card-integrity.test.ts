/**
 * Pack 08I.11 — Initiative card semantic labels + hierarchy integrity.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  looksLikeRawI18nKey,
  normalizeInitiativeStatusCode,
} from "../public-initiative-experience/normalize-initiative-status-code.js";
import { normalizeInitiativeStageCode } from "../public-initiative-experience/normalize-initiative-stage-code.js";
import {
  resolveInitiativeStatusDisplayLabel,
  resolveLifecycleStageDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import {
  humanizeInitiativeSemanticCode,
  resolveInitiativeCardBadgeLabel,
  resolveInitiativeCardStageLabel,
  resolveInitiativeCardStatusLabel,
  sanitizeInitiativeCardLabel,
} from "./resolve-initiative-card-semantic-labels.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.11 — Stage/Status normalization + raw-key guard", () => {
  it("normalizes Proposal / proposal / PROPOSAL to status code proposal", () => {
    assert.equal(normalizeInitiativeStatusCode("Proposal"), "proposal");
    assert.equal(normalizeInitiativeStatusCode("proposal"), "proposal");
    assert.equal(normalizeInitiativeStatusCode("PROPOSAL"), "proposal");
    assert.equal(normalizeInitiativeStatusCode("Ready For Poll"), "ready_for_poll");
  });

  it("normalizes lifecycle stage labels without treating Title-Case status as stage for cards", () => {
    assert.equal(normalizeInitiativeStageCode("decision_session"), "decision_session");
    assert.equal(normalizeInitiativeStageCode("Collaborative Analysis"), "analysis");
    assert.equal(normalizeInitiativeStageCode("Improvement Proposals"), "proposal");
    // Card stage resolver must refuse single Title-Case status tokens.
    assert.equal(resolveInitiativeCardStageLabel("Proposal", {}), "");
  });

  it("UK/zh-Hant/ar/en status labels never leak raw keys for Proposal", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      for (const input of ["Proposal", "proposal", "PROPOSAL"]) {
        const label = resolveInitiativeCardStatusLabel(input, messages);
        assert.ok(label.trim(), `${locale} ${input}`);
        assert.equal(looksLikeRawI18nKey(label), false, label);
        assert.doesNotMatch(label, /initiativeExperience\.(stages|statuses)/);
        assert.doesNotMatch(label, /\.Proposal$/);
      }
    }
  });

  it("sanitize rejects initiativeExperience.stages.Proposal / statuses.Proposal", () => {
    assert.equal(
      sanitizeInitiativeCardLabel("initiativeExperience.stages.Proposal", "Proposal"),
      "Proposal",
    );
    assert.equal(
      sanitizeInitiativeCardLabel("initiativeExperience.statuses.Proposal", "Proposal"),
      "Proposal",
    );
    assert.equal(sanitizeInitiativeCardLabel("Пропозиція", "Proposal"), "Пропозиція");
  });

  it("badge label prefers status catalog for world projection Title-Case fields", async () => {
    const { messages } = await loadUiMessagesForLocale("uk");
    const badge = resolveInitiativeCardBadgeLabel({
      publicStatus: "Proposal",
      currentStageLabel: "Proposal",
      messagesOrT: messages,
    });
    assert.equal(badge, "Пропозиція");
    assert.notEqual(badge, "Пропозиції покращення"); // not stages.proposal
  });

  it("missing catalog key → humanized fallback, never raw key", () => {
    const empty = {};
    const label = resolveInitiativeStatusDisplayLabel("Proposal", empty);
    assert.equal(looksLikeRawI18nKey(label), false);
    assert.equal(label, humanizeInitiativeSemanticCode("proposal"));
  });

  it("stage catalog coverage for all public stage ids", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const { messages } = await loadUiMessagesForLocale(locale);
      const experience = (messages as Record<string, unknown>).initiativeExperience as Record<
        string,
        unknown
      >;
      const stages = experience.stages as Record<string, string>;
      for (const id of [
        "initiative",
        "discussion",
        "analysis",
        "proposal",
        "petition",
        "decision_session",
        "collective_decision",
        "commitment",
        "tracking",
        "official_response",
        "public_impact",
        "archive",
      ]) {
        const stageLabel = stages[id];
        assert.ok(stageLabel?.trim(), `${locale}.stages.${id}`);
        assert.equal(looksLikeRawI18nKey(stageLabel ?? ""), false);
      }
      const statuses = experience.statuses as Record<string, string>;
      for (const id of [
        "draft",
        "proposal",
        "discussion",
        "revision",
        "ready_for_poll",
        "poll",
        "petition",
        "implementation",
        "completed",
        "archived",
        "revived",
        "superseded",
        "merged",
      ]) {
        assert.ok(statuses[id]?.trim(), `${locale}.statuses.${id}`);
      }
    }
  });
});

describe("Pack 08I.11 — Mounted card wiring + hierarchy", () => {
  it("mini / world / country / latest use shared semantic badge labels", () => {
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");
    const country = readWeb("features/country-experience/components/CountryInitiativeRailCard.tsx");
    const latest = readWeb("features/public-experience/components/LatestInitiativeCard.tsx");

    for (const src of [mini, world, country, latest]) {
      assert.match(src, /resolveInitiativeCardBadgeLabel|resolveInitiativeCardStatusLabel/);
      assert.match(src, /WorkspaceStatusBadge/);
      assert.match(src, /resolveInitiativeCardPresentation/);
    }
    assert.doesNotMatch(mini, /resolveLifecycleStageDisplayLabel\(\s*initiative\.currentStageLabel/);
  });

  it("world/mini cards expose title → badge → meta label/value → CTA hierarchy", () => {
    const miniCss = readWeb("features/public-initiative-mini-card/public-initiative-mini-card.css");
    const worldCss = readWeb("features/initiatives/components/world-initiatives-page.css");
    const mini = readWeb("features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx");
    const world = readWeb("features/initiatives/components/WorldInitiativesPageContent.tsx");

    assert.match(mini, /meta-label/);
    assert.match(mini, /meta-value/);
    assert.match(mini, /badge-row/);
    assert.match(world, /badge-row/);
    assert.doesNotMatch(world, /world-initiative-card__summary/);
    assert.doesNotMatch(mini, /public-initiative-mini-card__summary/);
    assert.match(miniCss, /font-weight:\s*700/);
    assert.match(miniCss, /margin-block-start:\s*auto|margin-top:\s*auto/);
    assert.match(miniCss, /border-block-start|border-top/);
    assert.match(worldCss, /grid-template-columns:\s*1fr/);
    assert.match(worldCss, /overflow-wrap:\s*anywhere/);
    assert.match(world, /formatInitiativeExperienceDate/);
  });

  it("resolveLifecycleStageDisplayLabel normalizes casing and guards keys", async () => {
    const { messages } = await loadUiMessagesForLocale("en");
    const label = resolveLifecycleStageDisplayLabel("decision_session", messages);
    assert.equal(label, "Decision Session");
    const guarded = sanitizeInitiativeCardLabel(
      "initiativeExperience.stages.Proposal",
      "Proposal",
    );
    assert.equal(guarded, "Proposal");
  });
});
