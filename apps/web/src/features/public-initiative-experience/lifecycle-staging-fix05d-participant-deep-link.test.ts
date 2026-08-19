/**
 * Lifecycle Staging Fix 05D — participant-specific Collaboration notification target.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyCollaborationNotificationScroll,
  buildCollaborationParticipantDomId,
  COLLABORATION_LIST_DOM_ID,
  parseCollaborationParticipantIdFromSearch,
  planCollaborationNotificationScroll,
} from "./discussion-comment-deep-link.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readLocal(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

describe("Lifecycle Staging Fix 05D — participant Collaboration deep-link", () => {
  const deepLink = readLocal("./discussion-comment-deep-link.ts");
  const discussion = readLocal("./components/PublicDiscussionPanel.tsx");
  const page = readLocal("./components/PublicInitiativeExperiencePage.tsx");
  const css = readLocal("./public-initiative-experience.css");
  const notifications = readRepo(
    "apps/api/src/modules/initiative-discussion-collaboration/initiative-discussion-collaboration-notifications.ts",
  );
  const service = readRepo(
    "apps/api/src/modules/initiative-discussion-collaboration/initiative-discussion-collaboration.service.ts",
  );

  it("invitation notification identifies one canonical Ally-row participant", () => {
    assert.match(notifications, /subjectParticipantId/);
    assert.match(notifications, /params\.set\("participant"/);
    assert.match(service, /subjectParticipantId:\s*targetParticipantId/);
    assert.match(service, /subjectParticipantId:\s*identity\.participantId/);
  });

  it("two invitation targets resolve to distinct row DOM ids (not first pending)", () => {
    const rowA = buildCollaborationParticipantDomId("participant-a");
    const rowB = buildCollaborationParticipantDomId("participant-b");
    assert.notEqual(rowA, rowB);
    assert.equal(rowA, "pie-collaboration-participant-participant-a");
    assert.equal(rowB, "pie-collaboration-participant-participant-b");

    const planA = planCollaborationNotificationScroll({
      viewportWidth: 1200,
      participantId: "participant-a",
    });
    const planB = planCollaborationNotificationScroll({
      viewportWidth: 1200,
      participantId: "participant-b",
    });
    assert.equal(planA.rowDomId, rowA);
    assert.equal(planB.rowDomId, rowB);
    assert.notEqual(planA.rowDomId, planB.rowDomId);
  });

  it("desktop participant deep-link is owned by pie-layout__center", () => {
    const plan = planCollaborationNotificationScroll({
      viewportWidth: 1280,
      participantId: "invitee-9",
    });
    assert.equal(plan.scrollOwner, "center_pane");
    assert.equal(plan.rowDomId, "pie-collaboration-participant-invitee-9");
    assert.equal(plan.primaryBlock, "start");
    assert.match(deepLink, /scrollElementWithinContainer/);
    assert.match(discussion, /focusCollaborationParticipantId/);
    assert.match(page, /parseCollaborationParticipantIdFromSearch/);
  });

  it("generic collaboration navigation remains without a participant target", () => {
    const plan = planCollaborationNotificationScroll({ viewportWidth: 1200 });
    assert.equal(plan.rowDomId, null);
    assert.equal(plan.listDomId, COLLABORATION_LIST_DOM_ID);
    assert.equal(parseCollaborationParticipantIdFromSearch("?filter=collaboration"), null);
    assert.equal(
      parseCollaborationParticipantIdFromSearch("?filter=collaboration&participant=p-1"),
      "p-1",
    );
  });

  it("collaboration rows expose stable participant DOM targets", () => {
    assert.match(discussion, /buildCollaborationParticipantDomId\(entry\.participantId\)/);
    assert.match(discussion, /data-participant-id=\{entry\.participantId\}/);
  });

  it("invitee Accept still uses respondToAlliesInvitation (no second Accept path)", () => {
    assert.match(discussion, /respondToAlliesInvitation/);
    assert.match(discussion, /Accept invitation/);
    assert.match(discussion, /resolveCollaborationInvitationAcceptState/);
  });

  it("author accepted-invitation notification targets the same invitee participant row", () => {
    // Author receives invitation_accepted; subject is the invitee (identity.participantId).
    assert.match(service, /subjectParticipantId:\s*identity\.participantId/);
    assert.match(service, /initiative_allies_invitation_accepted/);
    const acceptedPlan = planCollaborationNotificationScroll({
      viewportWidth: 1200,
      participantId: "invitee-accepted",
    });
    assert.equal(
      acceptedPlan.rowDomId,
      "pie-collaboration-participant-invitee-accepted",
    );
    assert.match(
      readLocal("./components/discussion-comment-presentation.ts"),
      /case "active":\s*return "Ally"/,
    );
  });

  it("Author does not see Accept on another participant's invitation_pending row", () => {
    assert.match(
      readLocal("./components/discussion-comment-presentation.ts"),
      /resolveCollaborationInvitationAcceptState/,
    );
    assert.match(discussion, /isOwnRow/);
  });

  it("Fix 05C footer handoff remains (no overscroll-behavior contain)", () => {
    assert.doesNotMatch(css, /overscroll-behavior:\s*contain/);
    assert.doesNotMatch(css, /\.humanity-layout:has\(\.pie-page\)/);
  });

  it("hero remains outside columns", () => {
    const layout = readLocal("./components/PublicCivicRecordExperienceLayout.tsx");
    const heroIndex = layout.indexOf('className="pie-layout__hero"');
    const columnsIndex = layout.indexOf('className="pie-layout pie-layout__columns"');
    assert.ok(heroIndex >= 0 && columnsIndex > heroIndex);
  });

  it("mobile keeps document owner for participant row", () => {
    const plan = planCollaborationNotificationScroll({
      viewportWidth: 500,
      participantId: "invitee-9",
    });
    assert.equal(plan.scrollOwner, "document");
    assert.equal(plan.rowDomId, "pie-collaboration-participant-invitee-9");
  });

  it("applyCollaborationNotificationScroll waits for the exact row (returns false when missing)", () => {
    const previousDocument = globalThis.document;
    globalThis.document = {
      getElementById: () => null,
      querySelector: () => null,
    } as unknown as Document;
    try {
      assert.equal(
        applyCollaborationNotificationScroll({
          viewportWidth: 1200,
          participantId: "missing-row",
        }),
        false,
      );
    } finally {
      globalThis.document = previousDocument;
    }
  });
});
