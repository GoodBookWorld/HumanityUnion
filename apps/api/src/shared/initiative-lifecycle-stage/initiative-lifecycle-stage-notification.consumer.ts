import type {
  CommunicationReminder,
  InitiativeAlly,
  InitiativeLifecycleStageId,
  MemberNotification,
} from "@hu/types";
import { getInitiativeLifecycleStageDefinition, getNextInitiativeLifecycleStageId } from "@hu/types";

import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { logger } from "../observability/logger.js";
import type { InitiativeLifecycleStagePublishedPayload } from "./initiative-lifecycle-stage-published.event.js";
import { resolveParticipantLanguageContext } from "../../modules/language/participant-language-context.js";
import { buildInitiativeLifecycleStageNotificationCopy } from "./initiative-lifecycle-stage-notification-copy.js";

export const INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID =
  "initiative-lifecycle-stage.notification.v1" as const;

/**
 * Injectable dependency seam (mirrors
 * `InitiativeActiveAlliesDependencies`/`InitiativeActiveAlliesDependencies`
 * in `initiative-active-allies.service.ts`) so the fan-out logic itself —
 * Author exclusion, dedup, batch identity resolution, notification
 * construction — is fully unit-testable without MongoDB. Integration tests
 * cover the real Mongo-backed default wiring separately.
 */
export interface InitiativeLifecycleStageNotificationDependencies {
  listActiveAllies(initiativeId: string): Promise<InitiativeAlly[]>;
  resolveRecipientIdentities(
    participantIds: readonly string[],
  ): Promise<Map<string, { userId: string; profileId: string }>>;
  createNotification(input: {
    recipientUserId: string;
    recipientProfileId: string;
    eventType: MemberNotification["eventType"];
    title: string;
    message: string;
    relatedEntityType: MemberNotification["relatedEntityType"];
    relatedEntityId: string;
    relatedUrl: string;
    priority: MemberNotification["priority"];
  }): Promise<MemberNotification>;
  /**
   * Lifecycle UX Correction Pack 01 Part 6/7 — "next Lifecycle step" is one
   * of the named Reminder generation sources. Optional and separate from
   * `createNotification` above: a Reminder is a distinct domain from a
   * Notification (Part 1), so a missing/no-op implementation here must
   * never prevent the notification fan-out itself from completing.
   */
  createReminder?(input: {
    recipientUserId: string;
    recipientProfileId: string;
    category: CommunicationReminder["category"];
    title: string;
    message: string;
    relatedEntityType: string;
    relatedEntityId: string;
    relatedUrl: string;
  }): Promise<CommunicationReminder>;
}

async function resolveRecipientIdentitiesViaAuthAndProfile(
  participantIds: readonly string[],
): Promise<Map<string, { userId: string; profileId: string }>> {
  const { findAuthUsersByMemberIds } = await import("../../modules/auth/auth-user.repository.js");
  const { findMemberProfilesByUserIds } = await import("../../modules/member-profile/member-profile.repository.js");

  const authUsersByParticipantId = await findAuthUsersByMemberIds(participantIds);
  const userIds = [...authUsersByParticipantId.values()].map((record) => record.userId);
  const profilesByUserId = await findMemberProfilesByUserIds(userIds);
  const result = new Map<string, { userId: string; profileId: string }>();

  for (const participantId of participantIds) {
    const authUser = authUsersByParticipantId.get(participantId);

    if (!authUser) {
      continue;
    }

    const profile = profilesByUserId.get(authUser.userId);
    result.set(participantId, { userId: authUser.userId, profileId: profile?.profileId ?? authUser.userId });
  }

  return result;
}

async function listActiveAlliesViaStore(initiativeId: string): Promise<InitiativeAlly[]> {
  const { listActiveAlliesByInitiative } = await import(
    "../../modules/initiative-discussion-collaboration/initiative-ally.store.js"
  );

  return listActiveAlliesByInitiative(initiativeId);
}

async function createNotificationViaService(
  input: Parameters<InitiativeLifecycleStageNotificationDependencies["createNotification"]>[0],
): ReturnType<InitiativeLifecycleStageNotificationDependencies["createNotification"]> {
  const { createNotification } = await import("../../modules/notifications/notification.service.js");

  return createNotification(input);
}

async function createReminderViaService(
  input: NonNullable<
    Parameters<NonNullable<InitiativeLifecycleStageNotificationDependencies["createReminder"]>>[0]
  >,
): Promise<CommunicationReminder> {
  const { createReminderIfNotExists } = await import("../../modules/reminders/reminder.service.js");

  return createReminderIfNotExists(input);
}

/**
 * Every real implementation here is a lazy `import()` (mirroring the
 * codebase's existing `verify-*-e2e.ts` scripts and
 * `shutdownEventInfrastructure`), not a static top-level import. This is
 * deliberate, not stylistic: a static import of `notification.service.js`
 * (and transitively `member-profile`/`auth-user` repositories) evaluates
 * that whole module graph — including its own module-level Mongo
 * configuration reads — the instant *this* file is imported, even for a
 * pure unit test that only ever calls this consumer with fully injected
 * test doubles. Deferring the real imports until a caller actually invokes
 * the default dependency keeps this module side-effect-free at import
 * time, matching `InitiativeActiveAlliesDependencies`'s test-friendly
 * design intent.
 */
export const defaultInitiativeLifecycleStageNotificationDependencies: InitiativeLifecycleStageNotificationDependencies =
  {
    listActiveAllies: listActiveAlliesViaStore,
    resolveRecipientIdentities: resolveRecipientIdentitiesViaAuthAndProfile,
    createNotification: createNotificationViaService,
    createReminder: createReminderViaService,
  };

/**
 * `CommunicationReminderCategory` predates the 12-stage lifecycle registry
 * (Communication UX Pack 03.4) and does not have a 1:1 entry for every
 * `InitiativeLifecycleStageId` (e.g. both `commitment`/`tracking` map onto
 * the single `"implementation"` category, and `archive` has no dedicated
 * category yet). This mapping is intentionally approximate — it only
 * drives which generic reminder "bucket" a Participant sees, never any
 * lifecycle-gating logic.
 */
function mapLifecycleStageIdToReminderCategory(stageId: string): CommunicationReminder["category"] {
  switch (stageId) {
    case "analysis":
      return "analysis";
    case "proposal":
      return "proposal";
    case "revision":
      return "revision";
    case "petition":
      return "petition";
    case "decision_session":
      return "decision";
    case "collective_decision":
      return "collective_decision";
    case "commitment":
    case "tracking":
      return "implementation";
    case "official_response":
      return "official_response";
    case "public_impact":
      return "public_impact";
    default:
      return "initiative";
  }
}

class InitiativeLifecycleStageNotificationValidationError extends Error {}

function isInitiativeLifecycleStagePublishedPayload(
  payload: Record<string, unknown>,
): payload is InitiativeLifecycleStagePublishedPayload {
  return (
    typeof payload.initiativeId === "string" &&
    typeof payload.initiativeTitle === "string" &&
    typeof payload.stageId === "string" &&
    typeof payload.stageLabel === "string" &&
    typeof payload.stageArtifactId === "string" &&
    typeof payload.stageVersion === "number" &&
    typeof payload.actorParticipantId === "string" &&
    typeof payload.publicationKind === "string" &&
    typeof payload.relatedUrl === "string" &&
    typeof payload.occurredAt === "string"
  );
}

function assertNoForbiddenFields(payload: Record<string, unknown>): void {
  for (const forbidden of ["password", "passwordHash", "token", "email", "refreshToken"]) {
    if (forbidden in payload) {
      throw new InitiativeLifecycleStageNotificationValidationError(
        `InitiativeLifecycleStagePublished payload must not include forbidden field "${forbidden}".`,
      );
    }
  }
}

export function validateInitiativeLifecycleStagePublishedEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): InitiativeLifecycleStagePublishedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.initiativeLifecycleStagePublished) {
    throw new InitiativeLifecycleStageNotificationValidationError(
      `Initiative Lifecycle Stage notification consumer requires ${CATALOGUE_EVENTS.initiativeLifecycleStagePublished}.`,
    );
  }

  assertNoForbiddenFields(envelope.payload);

  if (!isInitiativeLifecycleStagePublishedPayload(envelope.payload)) {
    throw new InitiativeLifecycleStageNotificationValidationError(
      "InitiativeLifecycleStagePublished payload is invalid.",
    );
  }

  return envelope.payload;
}

/**
 * Initiative Lifecycle Part A Part 14/25 — Active Ally notification
 * fan-out. Batch-resolves recipient identity (Part 25 — no N+1 lookup: one
 * `findAuthUsersByMemberIds` + one `findMemberProfilesByUserIds` call for
 * the whole Ally list, mirroring `initiative-active-allies.service.ts`),
 * excludes the acting Author, and sends one notification per Active Ally.
 *
 * Retry-safe (Part 17): the outbox dispatcher's `processed-events` claim
 * (keyed by `(consumerId, eventId)`) guarantees this handler runs at most
 * once per event, and the event id itself is already deduplicated
 * per-transition upstream (`publishInitiativeLifecycleStage`) — so a
 * publish retry can never fan out a second round of notifications.
 */
export async function handleInitiativeLifecycleStagePublishedNotification(
  envelope: CanonicalDomainEventEnvelope,
  deps: InitiativeLifecycleStageNotificationDependencies = defaultInitiativeLifecycleStageNotificationDependencies,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateInitiativeLifecycleStagePublishedEnvelope(envelope);

  logger.info("initiative_lifecycle_stage.notification_fanout.started", {
    component: "initiative-lifecycle-stage-notification",
    consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    initiativeId: payload.initiativeId,
    stageId: payload.stageId,
  });

  try {
    const allies = await deps.listActiveAllies(payload.initiativeId);
    const recipientParticipantIds = [
      ...new Set(
        allies
          .map((ally) => ally.participantId)
          .filter((participantId) => participantId !== payload.actorParticipantId),
      ),
    ];

    if (recipientParticipantIds.length === 0) {
      logger.info("initiative_lifecycle_stage.notification_fanout.no_recipients", {
        component: "initiative-lifecycle-stage-notification",
        consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        initiativeId: payload.initiativeId,
        stageId: payload.stageId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    const identitiesByParticipantId = await deps.resolveRecipientIdentities(recipientParticipantIds);

    let notifiedCount = 0;

    /**
     * Part 6/7 — "next Lifecycle step" Reminder. Computed once per event
     * (not per-recipient): the next stage in the canonical ordering is the
     * same for every Active Ally, and a stage at the end of the lifecycle
     * (or one with no successor) simply produces no Reminder.
     */
    const nextStageId = getNextInitiativeLifecycleStageId(payload.stageId as InitiativeLifecycleStageId);
    const nextStageDefinition = nextStageId ? getInitiativeLifecycleStageDefinition(nextStageId) : null;
    const nextStageUrl = nextStageDefinition
      ? `${payload.relatedUrl.split("#")[0]}#${nextStageDefinition.hash}`
      : null;

    for (const participantId of recipientParticipantIds) {
      const identity = identitiesByParticipantId.get(participantId);

      if (!identity) {
        continue;
      }

      const language = resolveParticipantLanguageContext(participantId);
      const copy = buildInitiativeLifecycleStageNotificationCopy({
        stageId: payload.stageId,
        stageLabel: payload.stageLabel,
        initiativeTitle: payload.initiativeTitle,
        publicationKind: payload.publicationKind,
        preferredLanguage: language.interfaceLanguage,
      });

      await deps.createNotification({
        recipientUserId: identity.userId,
        recipientProfileId: identity.profileId,
        eventType: "initiative_lifecycle_stage_published",
        title: copy.title,
        message: copy.message,
        relatedEntityType: "initiative",
        relatedEntityId: payload.initiativeId,
        relatedUrl: payload.relatedUrl,
        priority: "normal",
      });

      if (nextStageDefinition && nextStageUrl && deps.createReminder) {
        await deps.createReminder({
          recipientUserId: identity.userId,
          recipientProfileId: identity.profileId,
          category: mapLifecycleStageIdToReminderCategory(nextStageDefinition.stageId),
          title: `Review ${nextStageDefinition.label}`,
          message: `${payload.initiativeTitle}'s next Lifecycle stage — ${nextStageDefinition.label} — is ready for your input.`,
          relatedEntityType: "initiative",
          relatedEntityId: payload.initiativeId,
          relatedUrl: nextStageUrl,
        });
      }

      notifiedCount += 1;
    }

    logger.info("initiative_lifecycle_stage.notification_fanout.completed", {
      component: "initiative-lifecycle-stage-notification",
      consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      initiativeId: payload.initiativeId,
      stageId: payload.stageId,
      notifiedCount,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("initiative_lifecycle_stage.notification_fanout.failed", {
      component: "initiative-lifecycle-stage-notification",
      consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      initiativeId: payload.initiativeId,
      stageId: payload.stageId,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    throw error;
  }
}
