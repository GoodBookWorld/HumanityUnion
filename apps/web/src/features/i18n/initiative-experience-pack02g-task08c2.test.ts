/**
 * Pack 02G Task 08C.2 — Initiative collaboration / discussion / documents i18n.
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
  DISCUSSION_CHROME_LABELS_EN,
  resolveDiscussionChromeLabel,
  resolveProposalActionState,
  resolveStatusIndicatorKeys,
} from "../public-initiative-experience/components/discussion-comment-presentation.js";
import {
  resolveInitiativeExperienceMessage,
  resolveParticipationScopeDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function collabKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `collaboration.${key}`);
  assert.ok(value, `missing collaboration.${key}`);
  return value;
}

function docsKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `documents.${key}`);
  assert.ok(value, `missing documents.${key}`);
  return value;
}

describe("Pack 02G Task 08C.2 — Initiative collaboration/document i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes collaboration and documents", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof collabKey(loaded.messages, "discussion.title"), "string");
      assert.equal(typeof collabKey(loaded.messages, "channel.send"), "string");
      assert.equal(typeof collabKey(loaded.messages, "sessions.scheduleSession"), "string");
      assert.equal(typeof docsKey(loaded.messages, "title"), "string");
    }
  });

  it("Ukrainian collaboration/discussion and document chrome resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.ok(collabKey(uk.messages, "discussion.title").length > 0);
    assert.notEqual(collabKey(uk.messages, "discussion.title"), "Discussion");
    assert.ok(collabKey(uk.messages, "discussion.postComment").length > 0);
    assert.ok(collabKey(uk.messages, "workspace.channel").length > 0);
    assert.ok(collabKey(uk.messages, "channel.send").length > 0);
    assert.ok(docsKey(uk.messages, "upload").length > 0);
    assert.notEqual(docsKey(uk.messages, "upload"), "Upload document");
  });

  it("composer and chrome use catalogs; user content bindings remain", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    const docs = readWeb("features/shared-documents/components/SharedDocumentsPanel.tsx");

    assert.match(discussion, /collaboration\.discussion\.addComment/);
    assert.match(discussion, /collaboration\.discussion\.postComment/);
    assert.match(discussion, /comment\.body/);
    assert.match(discussion, /author\.displayName|comment\.author\.displayName/);
    assert.doesNotMatch(discussion, />Post comment</);
    assert.doesNotMatch(discussion, />Add a comment</);

    assert.match(channel, /collaboration\.channel\.send/);
    assert.match(channel, /message\.text/);
    assert.match(docs, /documents\.upload/);
    assert.match(docs, /document\.fileName/);
    assert.doesNotMatch(docs, />Upload document</);
  });

  it("stable chrome codes map to localized labels; canonical codes unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    for (const key of Object.keys(DISCUSSION_CHROME_LABELS_EN) as Array<
      keyof typeof DISCUSSION_CHROME_LABELS_EN
    >) {
      assert.equal(resolveDiscussionChromeLabel(key), DISCUSSION_CHROME_LABELS_EN[key]);
      const localized = collabKey(uk.messages, `discussion.chrome.${key}`);
      assert.ok(localized.length > 0);
    }

    const proposal = resolveProposalActionState(
      {
        proposalCandidateStatus: "candidate",
        authorAllyStatus: "none",
        viewerAllyStatus: "none",
        isAuthorInitiativeSteward: false,
        isViewerAuthor: false,
        isViewerInitiativeSteward: false,
        canMarkProposal: false,
        canReadyToCollaborate: false,
        canInviteToAllies: false,
        authorParticipantId: null,
      },
      false,
    );
    assert.equal(proposal.labelKey, "proposalAddedChecked");
    assert.deepEqual(
      resolveStatusIndicatorKeys({
        proposalCandidateStatus: "candidate",
        authorAllyStatus: "active",
        viewerAllyStatus: "none",
        isAuthorInitiativeSteward: false,
        isViewerAuthor: false,
        isViewerInitiativeSteward: false,
        canMarkProposal: false,
        canReadyToCollaborate: false,
        canInviteToAllies: false,
        authorParticipantId: null,
      }),
      ["proposalAdded", "ally"],
    );

    const docs = readWeb("features/shared-documents/components/SharedDocumentsPanel.tsx");
    assert.match(docs, /documents\.verified/);
    assert.match(docs, /verificationStatus/);
  });

  it("participationScope code maps to Ukrainian display label; canonical code unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    const canonical = "community" as const;

    assert.equal(
      resolveInitiativeExperienceMessage(en.messages, "manage.scopes.community"),
      "Community",
    );
    assert.equal(
      resolveParticipationScopeDisplayLabel(canonical, uk.messages),
      "Спільнота",
    );
    assert.notEqual(
      resolveParticipationScopeDisplayLabel(canonical, uk.messages),
      canonical,
    );
    // Unknown codes fall through unchanged (no English sentence matching).
    assert.equal(
      resolveParticipationScopeDisplayLabel("unknown_scope_x", uk.messages),
      "unknown_scope_x",
    );

    const vote = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(vote, /resolveParticipationScopeDisplayLabel/);
    assert.match(vote, /projection\.participationScope/);
    assert.doesNotMatch(
      vote,
      /closesMeta[\s\S]{0,200}scope:\s*projection\.participationScope/,
    );
  });

  it("counts/plurals use ICU catalogs, not English branching in widgets", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    const sessions = readWeb(
      "features/initiative-collaboration-sessions/components/InitiativeCollaborationSessionsPanel.tsx",
    );

    assert.match(discussion, /collaboration\.discussion\.commentsCount/);
    assert.doesNotMatch(discussion, /comment\$\{|comments" : "/);
    assert.match(channel, /collaboration\.channel\.(unreadCount|participantsCount)/);
    assert.match(sessions, /collaboration\.sessions\.(acceptedCount|durationMin)/);
    assert.match(sessions, /\{count,\s*plural|acceptedCount/);
  });

  it("locale-aware dates are used for discussion/channel/documents timestamps", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    const channel = readWeb(
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
    );
    const vote = readWeb(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    const docsFormat = readWeb("features/shared-documents/shared-documents-format.ts");
    const channelFormat = readWeb(
      "features/initiative-collaboration-channel/collaboration-channel-format.ts",
    );

    assert.match(discussion, /useLocale|formatInitiativeExperienceDate/);
    assert.match(channel, /useLocale/);
    assert.match(vote, /useLocale/);
    assert.match(vote, /toLocaleString\(locale\)/);
    assert.match(docsFormat, /locale/);
    assert.match(channelFormat, /locale/);
    assert.doesNotMatch(channelFormat, /toLocaleString\(undefined/);
  });

  it("accessible names use collaboration/documents catalogs", () => {
    const discussion = readWeb(
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    const docs = readWeb("features/shared-documents/components/SharedDocumentsPanel.tsx");
    const workspace = readWeb(
      "features/public-initiative-experience/components/InitiativeCollaborationWorkspace.tsx",
    );

    assert.match(discussion, /collaboration\.discussion\.feedbackActionsAria/);
    assert.match(discussion, /collaboration\.discussion\.helpfulAria/);
    assert.doesNotMatch(discussion, /aria-label="Comment feedback actions"/);
    assert.match(docs, /documents\.downloadAria/);
    assert.match(workspace, /collaboration\.workspace\.aria/);
  });

  it("no Gemini/runtime machine UI translation in collaboration/document surfaces", () => {
    const files = [
      "features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
      "features/initiative-collaboration-channel/components/InitiativeCollaborationChannel.tsx",
      "features/initiative-collaboration-sessions/components/InitiativeCollaborationSessionsPanel.tsx",
      "features/shared-documents/components/SharedDocumentsPanel.tsx",
      "features/public-initiative-experience/components/InitiativeCollaborationWorkspace.tsx",
    ];
    for (const file of files) {
      const source = readWeb(file);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.match(source, /useTranslations\("initiativeExperience"\)/);
    }
  });

  it("missing collaboration key fails raw catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { collaboration?: { discussion?: { title?: string } } })
      .collaboration?.discussion?.title;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.collaboration.discussion.title"),
      ),
    );
  });
});
