import type { ClientSession } from "mongodb";

import type {
  InitiativeLifecycleProfile,
  InitiativeLifecycleStageId,
  InitiativeLifecycleStagePublicationEvent,
  InitiativeLifecycleStagePublicationKind,
} from "@hu/types";
import { isInitiativeLifecycleStageId } from "@hu/types";

import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import { logger } from "../observability/logger.js";
import { createInitiativeLifecycleStagePublishedEvent } from "./initiative-lifecycle-stage-published.event.js";
import { summarizeLifecycleTransitionPostcondition } from "./initiative-lifecycle-transition.contract.js";

export interface PublishInitiativeLifecycleStageInput {
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly stageArtifactId: string;
  readonly stageVersion: number;
  readonly actorParticipantId: string;
  readonly publicationKind: InitiativeLifecycleStagePublicationKind;
  /** Deep-link to the published result — always the existing canonical stage route/hash (Part 16). */
  readonly relatedUrl: string;
  /** Optional session for callers wiring this atomically into their own domain-write transaction. */
  readonly session?: ClientSession;
  /**
   * Phase 02 — optional profile for next-stage observability. Missing → STANDARD
   * via the shared transition helper (historical Initiatives).
   */
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

export type PublishInitiativeLifecycleStageOutcome = "enqueued" | "duplicate_ignored";

export interface PublishInitiativeLifecycleStageResult {
  readonly outcome: PublishInitiativeLifecycleStageOutcome;
  readonly event: InitiativeLifecycleStagePublicationEvent;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

/**
 * Initiative Lifecycle Part A Part 13/17/18 — the single reusable
 * publication + notification entry point every stage domain calls exactly
 * once, after its own state transition has already durably succeeded.
 *
 * Contract (Part 13 — "Do not emit ... an idempotent publish retry that
 * produces no real state change"): callers are responsible for only
 * invoking this once per genuine publish/open/finalize/fix transition
 * (e.g. after their own status guard already rejected a second publish
 * attempt with a domain-specific "already published" error). This
 * function adds a second, storage-level idempotency layer on top of that:
 * the event id is deterministic per
 * `(initiativeId, stageId, stageVersion, publicationKind)`
 * (see `buildInitiativeLifecycleStagePublishedEventId`), and the outbox's
 * unique index on `eventId` means a genuine retry for the exact same
 * transition can never enqueue a second event or, downstream, send a
 * second Active Ally notification — it resolves to `"duplicate_ignored"`
 * rather than throwing, since notification delivery must never fail an
 * already-successful publish.
 *
 * Reuses the existing durable outbox (`enqueueDomainEvent`) exactly like
 * `ProposalCreated`/`PetitionSigned` — no second event bus. Does not
 * itself require a transaction: durability comes from the outbox insert
 * itself. Callers that want this enqueue to be atomic with their own
 * aggregate write may pass `session`.
 */
export async function publishInitiativeLifecycleStage(
  input: PublishInitiativeLifecycleStageInput,
): Promise<PublishInitiativeLifecycleStageResult> {
  const event = createInitiativeLifecycleStagePublishedEvent({
    initiativeId: input.initiativeId,
    initiativeTitle: input.initiativeTitle,
    stageId: input.stageId,
    stageLabel: input.stageLabel,
    stageArtifactId: input.stageArtifactId,
    stageVersion: input.stageVersion,
    actorParticipantId: input.actorParticipantId,
    publicationKind: input.publicationKind,
    relatedUrl: input.relatedUrl,
  });

  const publicationEvent: InitiativeLifecycleStagePublicationEvent = {
    eventId: event.eventId,
    initiativeId: input.initiativeId,
    initiativeTitle: input.initiativeTitle,
    stageId: input.stageId as InitiativeLifecycleStagePublicationEvent["stageId"],
    stageLabel: input.stageLabel,
    stageArtifactId: input.stageArtifactId,
    stageVersion: input.stageVersion,
    actorParticipantId: input.actorParticipantId,
    occurredAt: event.metadata.occurredAt,
    publicationKind: input.publicationKind,
    relatedUrl: input.relatedUrl,
  };

  try {
    await enqueueDomainEvent(event, { session: input.session });

    const transition =
      isInitiativeLifecycleStageId(input.stageId)
        ? summarizeLifecycleTransitionPostcondition({
            initiativeId: input.initiativeId,
            publishedStageId: input.stageId as InitiativeLifecycleStageId,
            lifecycleProfile: input.lifecycleProfile,
          })
        : null;

    logger.info("initiative_lifecycle_stage.publication_enqueued", {
      component: "initiative-lifecycle-stage-publication",
      eventId: event.eventId,
      initiativeId: input.initiativeId,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      publicationKind: input.publicationKind,
      nextStageId: transition?.nextStageId ?? null,
      transitionMessage: transition?.message,
    });

    return { outcome: "enqueued", event: publicationEvent };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    logger.info("initiative_lifecycle_stage.publication_duplicate_ignored", {
      component: "initiative-lifecycle-stage-publication",
      eventId: event.eventId,
      initiativeId: input.initiativeId,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      publicationKind: input.publicationKind,
    });

    return { outcome: "duplicate_ignored", event: publicationEvent };
  }
}
