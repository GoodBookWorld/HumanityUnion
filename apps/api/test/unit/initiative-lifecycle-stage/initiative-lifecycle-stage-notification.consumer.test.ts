import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeAlly } from "@hu/types";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
import { createInitiativeLifecycleStagePublishedEvent } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-published.event.js";
import {
  handleInitiativeLifecycleStagePublishedNotification,
  type InitiativeLifecycleStageNotificationDependencies,
  validateInitiativeLifecycleStagePublishedEnvelope,
} from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-stage-notification.consumer.js";

const INITIATIVE_ID = "initiative-lifecycle-notify-1";
const AUTHOR_ID = "participant-author";

function buildAlly(participantId: string): InitiativeAlly {
  return {
    initiativeId: INITIATIVE_ID,
    participantId,
    status: "active",
    requestedByParticipantId: participantId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function buildEnvelope(overrides: Partial<Parameters<typeof createInitiativeLifecycleStagePublishedEvent>[0]> = {}) {
  const event = createInitiativeLifecycleStagePublishedEvent({
    initiativeId: INITIATIVE_ID,
    initiativeTitle: "Community Water Quality Review",
    stageId: "analysis",
    stageLabel: "Collaborative Analysis",
    stageArtifactId: "analysis-record-1",
    stageVersion: 1,
    actorParticipantId: AUTHOR_ID,
    publicationKind: "published",
    relatedUrl: `/initiatives/public/${INITIATIVE_ID}#collaborative-analysis`,
    ...overrides,
  });

  return toCanonicalEnvelope(event);
}

interface RecordedNotification {
  recipientUserId: string;
  title: string;
  message: string;
  relatedUrl: string;
}

interface RecordedReminder {
  recipientUserId: string;
  category: string;
  title: string;
  relatedUrl: string;
}

function buildDeps(overrides: Partial<InitiativeLifecycleStageNotificationDependencies> = {}) {
  const created: RecordedNotification[] = [];
  const createdReminders: RecordedReminder[] = [];

  const deps: InitiativeLifecycleStageNotificationDependencies = {
    listActiveAllies: async () => [],
    resolveRecipientIdentities: async (participantIds) =>
      new Map(participantIds.map((id) => [id, { userId: `user-${id}`, profileId: `profile-${id}` }])),
    createNotification: async (input) => {
      created.push({
        recipientUserId: input.recipientUserId,
        title: input.title,
        message: input.message,
        relatedUrl: input.relatedUrl,
      });

      return {
        notificationId: `notification-${created.length}`,
        recipientUserId: input.recipientUserId,
        recipientProfileId: input.recipientProfileId,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        relatedUrl: input.relatedUrl,
        priority: input.priority,
        status: "unread",
        createdAt: new Date().toISOString(),
      };
    },
    createReminder: async (input) => {
      createdReminders.push({
        recipientUserId: input.recipientUserId,
        category: input.category,
        title: input.title,
        relatedUrl: input.relatedUrl,
      });

      return {
        reminderId: `reminder-${createdReminders.length}`,
        recipientUserId: input.recipientUserId,
        recipientProfileId: input.recipientProfileId,
        category: input.category,
        title: input.title,
        message: input.message,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        relatedUrl: input.relatedUrl,
        status: "active",
        createdAt: new Date().toISOString(),
      };
    },
    ...overrides,
  };

  return { deps, created, createdReminders };
}

describe("Initiative Lifecycle Part A — Active Ally notification fan-out consumer", () => {
  it("rejects an envelope for a different event name", () => {
    const wrongEnvelope = { ...buildEnvelope(), eventName: "SomethingElse" };

    assert.throws(() => validateInitiativeLifecycleStagePublishedEnvelope(wrongEnvelope));
  });

  it("sends exactly one notification per Active Ally, excluding the acting Author", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1"), buildAlly("participant-ally-2"), buildAlly(AUTHOR_ID)],
    });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope(), deps);

    assert.equal(created.length, 2);
    assert.ok(created.every((notification) => notification.recipientUserId !== `user-${AUTHOR_ID}`));
  });

  it("deduplicates a repeated Ally participantId before resolving identities", async () => {
    let resolveCallCount = 0;
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1"), buildAlly("participant-ally-1")],
      resolveRecipientIdentities: async (participantIds) => {
        resolveCallCount += 1;
        return new Map(participantIds.map((id) => [id, { userId: `user-${id}`, profileId: `profile-${id}` }]));
      },
    });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope(), deps);

    assert.equal(resolveCallCount, 1);
    assert.equal(created.length, 1);
  });

  it("resolves recipient identities in exactly one batched call, never once per Ally (Part 25 — no N+1)", async () => {
    let resolveCallCount = 0;
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1"), buildAlly("participant-ally-2"), buildAlly("participant-ally-3")],
      resolveRecipientIdentities: async (participantIds) => {
        resolveCallCount += 1;
        return new Map(participantIds.map((id) => [id, { userId: `user-${id}`, profileId: `profile-${id}` }]));
      },
    });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope(), deps);

    assert.equal(resolveCallCount, 1);
    assert.equal(created.length, 3);
  });

  it("sends no notification when there are no Active Allies", async () => {
    const { deps, created } = buildDeps({ listActiveAllies: async () => [] });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope(), deps);

    assert.equal(created.length, 0);
  });

  it("skips a recipient whose identity cannot be resolved instead of throwing", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-unresolvable")],
      resolveRecipientIdentities: async () => new Map(),
    });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope(), deps);

    assert.equal(created.length, 0);
  });

  it("builds stage-specific, Initiative-specific copy rather than generic boilerplate (a stage without Part B's fixed-copy override)", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1")],
    });

    await handleInitiativeLifecycleStagePublishedNotification(
      buildEnvelope({
        stageId: "petition",
        stageLabel: "Petition",
        initiativeTitle: "Community Water Quality Review",
      }),
      deps,
    );

    assert.equal(created.length, 1);
    assert.match(created[0]!.message, /Petition/);
    assert.match(created[0]!.message, /Community Water Quality Review/);
  });

  it("uses Part B's exact, fixed Collaborative Analysis copy — never interpolating the Initiative title (Section 10)", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1")],
    });

    await handleInitiativeLifecycleStagePublishedNotification(
      buildEnvelope({ stageLabel: "Collaborative Analysis", initiativeTitle: "Community Water Quality Review" }),
      deps,
    );

    assert.equal(created.length, 1);
    assert.equal(created[0]!.title, "Collaborative Analysis Published");
    assert.equal(
      created[0]!.message,
      "The Initiative Author has published a new Collaborative Analysis.",
    );
  });

  it("uses Part D's Improvement Proposals copy, interpolating the Initiative title (Section 10)", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1")],
    });

    await handleInitiativeLifecycleStagePublishedNotification(
      buildEnvelope({
        stageId: "proposal",
        stageLabel: "Improvement Proposals",
        initiativeTitle: "Community Water Quality Review",
        relatedUrl: `/initiatives/public/${INITIATIVE_ID}#improvement-proposals`,
      }),
      deps,
    );

    assert.equal(created.length, 1);
    assert.equal(created[0]!.title, "Improvement Proposals Published");
    assert.equal(
      created[0]!.message,
      'The Initiative Author has published new Improvement Proposals for "Community Water Quality Review".',
    );
  });

  it("excludes the publishing Author from Improvement Proposals notifications, same as every other stage", async () => {
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1"), buildAlly(AUTHOR_ID)],
    });

    await handleInitiativeLifecycleStagePublishedNotification(
      buildEnvelope({ stageId: "proposal", stageLabel: "Improvement Proposals" }),
      deps,
    );

    assert.equal(created.length, 1);
    assert.ok(created.every((notification) => notification.recipientUserId !== `user-${AUTHOR_ID}`));
  });

  it("uses the exact relatedUrl the event carried — never invents a new route", async () => {
    const relatedUrl = `/initiatives/public/${INITIATIVE_ID}#collaborative-analysis`;
    const { deps, created } = buildDeps({
      listActiveAllies: async () => [buildAlly("participant-ally-1")],
    });

    await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope({ relatedUrl }), deps);

    assert.equal(created[0]?.relatedUrl, relatedUrl);
  });

  describe("Lifecycle UX Correction Pack 01 Part 6/7 — 'next Lifecycle step' Reminder generation", () => {
    it("generates one 'Review {next stage}' Reminder per Active Ally alongside the notification", async () => {
      const { deps, createdReminders } = buildDeps({
        listActiveAllies: async () => [buildAlly("participant-ally-1"), buildAlly("participant-ally-2")],
      });

      await handleInitiativeLifecycleStagePublishedNotification(
        buildEnvelope({ stageId: "analysis", relatedUrl: `/initiatives/public/${INITIATIVE_ID}#collaborative-analysis` }),
        deps,
      );

      assert.equal(createdReminders.length, 2);
      assert.ok(createdReminders.every((reminder) => reminder.title === "Review Improvement Proposals"));
      assert.ok(createdReminders.every((reminder) => reminder.relatedUrl.endsWith("#improvement-proposals")));
      assert.ok(createdReminders.every((reminder) => reminder.category === "proposal"));
    });

    it("generates a 'Review Petition' Reminder when Improvement Proposals is published", async () => {
      const { deps, createdReminders } = buildDeps({
        listActiveAllies: async () => [buildAlly("participant-ally-1")],
      });

      await handleInitiativeLifecycleStagePublishedNotification(
        buildEnvelope({
          stageId: "proposal",
          stageLabel: "Improvement Proposals",
          relatedUrl: `/initiatives/public/${INITIATIVE_ID}#improvement-proposals`,
        }),
        deps,
      );

      assert.equal(createdReminders.length, 1);
      assert.equal(createdReminders[0]!.title, "Review Petition");
      assert.ok(createdReminders[0]!.relatedUrl.endsWith("#petition"));
      assert.equal(createdReminders[0]!.category, "petition");
    });

    it("never generates a Reminder for the last stage in the lifecycle (no next stage)", async () => {
      const { deps, createdReminders } = buildDeps({
        listActiveAllies: async () => [buildAlly("participant-ally-1")],
      });

      await handleInitiativeLifecycleStagePublishedNotification(
        buildEnvelope({
          stageId: "archive",
          stageLabel: "Civic Archive",
          relatedUrl: `/initiatives/public/${INITIATIVE_ID}#civic-archive`,
        }),
        deps,
      );

      assert.equal(createdReminders.length, 0);
    });

    it("still sends the notification fan-out when no createReminder dependency is provided at all", async () => {
      const { deps, created } = buildDeps({
        listActiveAllies: async () => [buildAlly("participant-ally-1")],
        createReminder: undefined,
      });

      await handleInitiativeLifecycleStagePublishedNotification(buildEnvelope({ stageId: "analysis" }), deps);

      assert.equal(created.length, 1);
    });
  });
});
