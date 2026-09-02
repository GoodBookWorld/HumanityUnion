/**
 * Pack 02G Task 08G — Voting unavailable codes, system-event presentation,
 * tracking predicates, PWA feed chrome, Select-One quarantine.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  IMPLEMENTATION_TRACKING_CANDIDATE_STAGE,
  isImplementationTrackingCandidateCompleted,
  isImplementationTrackingCandidatePreparation,
  SUGGESTED_IMPLEMENTATION_TRACKING_STAGES,
} from "@hu/types";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  describeCollectiveDecisionVotingUnavailable,
  resolveCollectiveDecisionVotingUnavailableCode,
} from "../initiative-collective-decision-lifecycle/collective-decision-voting.js";
import {
  resolveCollaborationChannelSystemEventDisplay,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
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

function translatorFor(messages: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>) => {
    let text = ieKey(messages, key);
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

const UNAVAILABLE_CODES = [
  "cancelled",
  "closed",
  "not_opened",
  "window_not_open",
  "window_closed",
] as const;

const SYSTEM_EVENT_KEYS = [
  "collaboration.channel.systemEvents.ally_joined",
  "collaboration.channel.systemEvents.collaboration_accepted",
  "collaboration.channel.systemEvents.session_scheduled",
  "collaboration.channel.systemEvents.petition_published",
  "collaboration.channel.systemEvents.collective_decision_updated",
  "collaboration.channel.systemEvents.defaultNames.ally_joined",
  "collaboration.channel.systemEvents.defaultNames.collaboration_accepted",
] as const;

const FEED_KEYS = [
  "pwa.feed.title",
  "pwa.feed.loading",
  "pwa.feed.error",
  "pwa.feed.matchedPriorities",
  "pwa.feed.newestPublic",
  "pwa.feed.carouselAria",
  "pwa.feed.viewAll",
] as const;

describe("Pack 02G Task 08G — Voting unavailable codes", () => {
  const openProjection = {
    status: "opened" as const,
    openedAt: "2026-01-01T00:00:00.000Z",
    closesAt: "2099-01-01T00:00:00.000Z",
  };
  const now = Date.parse("2026-06-01T00:00:00.000Z");

  it("resolves stable semantic codes for each unavailable branch", () => {
    assert.equal(
      resolveCollectiveDecisionVotingUnavailableCode({
        status: "cancelled",
        closesAt: "2026-01-02T00:00:00.000Z",
        cancelledAt: "2026-01-02T00:00:00.000Z",
      }),
      "cancelled",
    );
    assert.equal(
      resolveCollectiveDecisionVotingUnavailableCode({
        status: "closed",
        closesAt: "2026-01-02T00:00:00.000Z",
        closedAt: "2026-01-02T00:00:00.000Z",
      }),
      "closed",
    );
    assert.equal(
      resolveCollectiveDecisionVotingUnavailableCode({
        status: "draft",
        closesAt: "2099-01-01T00:00:00.000Z",
      } as unknown as Parameters<typeof resolveCollectiveDecisionVotingUnavailableCode>[0]),
      "not_opened",
    );
    assert.equal(
      resolveCollectiveDecisionVotingUnavailableCode(
        { ...openProjection, openedAt: "2026-12-01T00:00:00.000Z" },
        now,
      ),
      "window_not_open",
    );
    assert.equal(
      resolveCollectiveDecisionVotingUnavailableCode(
        { ...openProjection, closesAt: "2026-01-02T00:00:00.000Z" },
        now,
      ),
      "window_closed",
    );
    assert.equal(resolveCollectiveDecisionVotingUnavailableCode(openProjection, now), null);
  });

  it("deprecated English describe helper shares the same branches", () => {
    assert.equal(
      describeCollectiveDecisionVotingUnavailable({
        status: "cancelled",
        closesAt: "2026-01-02T00:00:00.000Z",
        cancelledAt: "2026-01-02T00:00:00.000Z",
      }),
      "This Collective Decision was cancelled. Voting is not available.",
    );
    assert.equal(describeCollectiveDecisionVotingUnavailable(openProjection, now), null);
  });

  it("catalog parity includes unavailableReasons.* and mounts localize via codes", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const code of UNAVAILABLE_CODES) {
        assert.equal(
          typeof ieKey(loaded.messages, `collaboration.vote.unavailableReasons.${code}`),
          "string",
        );
      }
    }

    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      ieKey(en.messages, "collaboration.vote.unavailableReasons.cancelled"),
      "This Collective Decision was cancelled. Voting is not available.",
    );
    assert.equal(
      ieKey(en.messages, "collaboration.vote.unavailableReasons.window_closed"),
      "The voting window has closed.",
    );

    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }

    const ballot = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
    );
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(ballot, /resolveCollectiveDecisionVotingUnavailableCode/);
    assert.match(ballot, /unavailableReasons\.\$\{unavailableCode\}/);
    assert.match(panel, /resolveCollectiveDecisionVotingUnavailableCode/);
    assert.match(panel, /unavailableReasons\.\$\{unavailableCode\}/);
  });
});

describe("Pack 02G Task 08G — Collaboration system events", () => {
  it("catalog parity includes systemEvents.*", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of SYSTEM_EVENT_KEYS) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }
  });

  it("resolver localizes known kinds; unknown → text; missing name → defaultNames", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);

    assert.equal(
      resolveCollaborationChannelSystemEventDisplay(
        {
          systemEventKind: "ally_joined",
          systemEventSubjectDisplayName: "Ada",
          text: "Ada joined the Collaboration Channel.",
        },
        t,
      ),
      "Ada joined the Collaboration Channel.",
    );

    assert.equal(
      resolveCollaborationChannelSystemEventDisplay(
        {
          systemEventKind: "ally_joined",
          text: "A new Ally joined the Collaboration Channel.",
        },
        t,
      ),
      "A new Ally joined the Collaboration Channel.",
    );

    assert.equal(
      resolveCollaborationChannelSystemEventDisplay(
        {
          systemEventKind: "session_scheduled",
          text: "A collaboration session was scheduled.",
        },
        t,
      ),
      "A collaboration session was scheduled.",
    );

    assert.equal(
      resolveCollaborationChannelSystemEventDisplay(
        {
          text: "Legacy English skew fallback.",
        },
        t,
      ),
      "Legacy English skew fallback.",
    );

    const uk = await loadUiMessagesForLocale("uk");
    const tUk = translatorFor(uk.messages);
    assert.doesNotMatch(
      resolveCollaborationChannelSystemEventDisplay(
        {
          systemEventKind: "petition_published",
          text: "The petition was published.",
        },
        tUk,
      ),
      /The petition was published/,
    );
  });

  it("channel mount uses system-event resolver", () => {
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    assert.match(channel, /resolveCollaborationChannelSystemEventDisplay/);
    assert.doesNotMatch(channel, /system-event-text">\{message\.text\}/);
  });
});

describe("Pack 02G Task 08G — Tracking domain predicates", () => {
  it("constants align with SUGGESTED stages and helpers compare tokens", () => {
    assert.equal(
      IMPLEMENTATION_TRACKING_CANDIDATE_STAGE.PREPARATION,
      SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[0],
    );
    assert.equal(
      IMPLEMENTATION_TRACKING_CANDIDATE_STAGE.COMPLETED,
      SUGGESTED_IMPLEMENTATION_TRACKING_STAGES[4],
    );
    assert.equal(isImplementationTrackingCandidatePreparation("Preparation"), true);
    assert.equal(isImplementationTrackingCandidatePreparation("Started"), false);
    assert.equal(isImplementationTrackingCandidateCompleted("Completed"), true);
    assert.equal(isImplementationTrackingCandidateCompleted("Preparation"), false);
  });

  it("derive + API call sites use helpers / constants", () => {
    const derive = readWeb(
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    );
    assert.match(derive, /isImplementationTrackingCandidatePreparation/);
    assert.match(derive, /isImplementationTrackingCandidateCompleted/);
    assert.doesNotMatch(derive, /currentStatus === "Preparation"/);
    assert.doesNotMatch(derive, /currentStatus !== "Completed"/);

    const draftBuilder = readFileSync(
      path.resolve(
        webSrc,
        "../../api/src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-draft-builder.ts",
      ),
      "utf8",
    );
    assert.match(draftBuilder, /IMPLEMENTATION_TRACKING_CANDIDATE_STAGE\.PREPARATION/);
    assert.doesNotMatch(draftBuilder, /DEFAULT_CURRENT_STATUS = "Preparation"/);
  });
});

describe("Pack 02G Task 08G — PWA Initiative Feed chrome", () => {
  it("catalog parity includes pwa.feed.* and mount uses translations", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of FEED_KEYS) {
        assert.equal(typeof readNested(loaded.messages as Record<string, unknown>, key), "string");
      }
    }

    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    assert.match(feed, /useTranslations\("pwa"\)/);
    assert.match(feed, /t\("feed\.title"\)/);
    assert.match(feed, /t\("feed\.loading"\)/);
    assert.match(feed, /t\("feed\.viewAll"\)/);
    assert.doesNotMatch(feed, />Initiatives</);
    assert.doesNotMatch(feed, /Loading Initiatives/);
    assert.doesNotMatch(feed, /View all Initiatives/);
    assert.match(feed, /item\.title/);
    assert.match(feed, /item\.explanation/);
  });
});
