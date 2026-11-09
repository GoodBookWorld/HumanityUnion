import { randomUUID } from "node:crypto";

import type {
  CollectiveDecision,
  Initiative,
  InitiativePetitionDraft,
  InitiativePetitionDraftContext,
  Petition,
  PetitionTraceability,
} from "@hu/types";

import { createDecision, getDecision } from "../collective-decision/collective-decision.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { defaultPetitionPolicy } from "../petition/petition.defaults.js";
import {
  createPetition,
  getPetition,
  listPetitionsByInitiativeId,
  openPetition,
  preparePetition,
} from "../petition/petition.store.js";
import { isPetitionPubliclyVisible } from "../petition/petition-public-visibility.js";
import {
  finalizePetitionPublication,
  injectPetitionSlotFault,
  isSimulatedPublicationCrash,
  publishPetitionInPublishedSlot,
  releasePetitionPublicationReservation,
  renewPetitionPublicationReservation,
  reservePetitionPublication,
} from "../initiative-petition-slots/petition-slot.service.js";
import { buildInitiativePetitionIntelligenceSnapshot } from "./initiative-petition-intelligence.service.js";
import { generatePetitionDraftContent } from "./initiative-petition-draft-builder.js";
import {
  deleteInitiativePetitionDraft,
  getInitiativePetitionDraftByInitiativeId,
  updateInitiativePetitionDraft,
  upsertInitiativePetitionDraft,
} from "./initiative-petition-draft.store.js";
import {
  validateInitiativePetitionDraftForPublication,
  type SaveInitiativePetitionDraftInput,
} from "./initiative-petition-lifecycle.validators.js";
import { ensureLazyWorkingArtifact } from "../../shared/lifecycle/lazy-stage-initialization.js";

const BOOTSTRAP_APPROVE_OPTION_ID = "option-petition-bootstrap-approve";
const BOOTSTRAP_REJECT_OPTION_ID = "option-petition-bootstrap-reject";

/** A draft's own Petition in these states is an interrupted publication to resume. */
const RESUMABLE_PUBLICATION_STATUSES = new Set<Petition["status"]>(["Draft", "Ready", "Published"]);

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

/**
 * Initiative Lifecycle — Part F. The pre-existing Petition domain
 * (`createPetition`) is gated by `assertApprovedCollectiveDecision` — a
 * constraint from before the 12-stage Lifecycle existed, when Petition was
 * reached only via a Collective Decision (Stage 6). Rather than
 * duplicating Petition's state machine/signature/eligibility logic (the
 * "Do NOT duplicate" mandate), this auto-provisions a synthetic, always-
 * "Approved" `CollectiveDecision` scoped to this one Initiative — mirroring
 * `bootstrapCollectiveDecision`'s shape exactly, but with unique, per-
 * Initiative ids — solely so `createPetition`'s existing gate is satisfied.
 * It carries no real ballot/participation; it is never surfaced to the
 * Author or the public as a "Collective Decision" to interact with (the
 * Author never sees a decisionId, only the Petition stage).
 *
 * HU-LC-05C.2 — one synthetic decision per Petition (its id derives from the
 * petitionId, satisfying the unique `collectiveDecisionId` index); a retried
 * publication reuses that same decision, never another Petition's.
 */
async function getOrCreatePetitionBootstrapDecision(
  initiative: Initiative,
  actorParticipantId: string,
  petitionId: string,
): Promise<CollectiveDecision> {
  const decisionId = `decision-${petitionId}`;
  const existing = getDecision(decisionId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const decision: CollectiveDecision = {
    decisionId,
    decisionSubjectType: "Initiative",
    decisionSubjectId: initiative.initiativeId,
    decisionMechanism: "CommunityPoll",
    status: "Completed",
    createdAt: now,
    updatedAt: now,
    ballot: {
      ballotId: `ballot-petition-lifecycle-${randomUUID()}`,
      question: `Should "${initiative.title}" proceed to the Petition stage?`,
      options: [
        {
          optionId: BOOTSTRAP_APPROVE_OPTION_ID,
          label: "Approve",
          description: "Proceed to the Petition stage.",
          value: "Approve",
          order: 1,
        },
        {
          optionId: BOOTSTRAP_REJECT_OPTION_ID,
          label: "Reject",
          description: "Do not proceed to the Petition stage.",
          value: "Reject",
          order: 2,
        },
      ],
      decisionRules: {
        quorumRequired: 1,
        minimumParticipationRate: 1,
        approvalThreshold: 50,
        winningMethod: "simple_majority",
        tiePolicy: "reject",
        abstentionPolicy: "exclude",
      },
      eligibilityRules: {
        membershipRequired: true,
        verificationLevelRequired: null,
        regionRequired: null,
        organizationRequired: null,
        minimumAccountAge: null,
        customEligibilityPolicy: null,
      },
      opensAt: now,
      closesAt: now,
    },
    participantDecisions: [
      {
        participantDecisionId: `participant-decision-petition-lifecycle-${randomUUID()}`,
        participantId: actorParticipantId,
        ballotId: `ballot-petition-lifecycle-${randomUUID()}`,
        selectedOptionIds: [BOOTSTRAP_APPROVE_OPTION_ID],
        submittedAt: now,
        status: "submitted",
      },
    ],
    decisionResult: {
      resultId: `result-petition-lifecycle-${randomUUID()}`,
      calculatedAt: now,
      optionResults: [
        { optionId: BOOTSTRAP_APPROVE_OPTION_ID, count: 1, percentage: 100 },
        { optionId: BOOTSTRAP_REJECT_OPTION_ID, count: 0, percentage: 0 },
      ],
      winningOptionId: BOOTSTRAP_APPROVE_OPTION_ID,
      participationRate: 100,
      quorumSatisfied: true,
      thresholdSatisfied: true,
    },
    outcome: {
      outcomeId: `outcome-petition-lifecycle-${randomUUID()}`,
      outcomeType: "Approved",
      createdAt: now,
      nextLifecycleStage: "Petition",
      explanation: `The Initiative Lifecycle Revision for "${initiative.title}" is ready for public participation.`,
    },
    statistics: {
      eligibleParticipantCount: 1,
      submittedDecisionCount: 1,
      participationRate: 100,
      completionRate: 100,
      abstentionCount: 0,
    },
    timeline: {
      createdAt: now,
      scheduledAt: now,
      opensAt: now,
      closesAt: now,
      completedAt: now,
      archivedAt: null,
    },
  };

  return createDecision(decision);
}

function getOrCreateWorkingPetitionDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativePetitionDraft {
  return ensureLazyWorkingArtifact({
    getExisting: () => getInitiativePetitionDraftByInitiativeId(initiative.initiativeId),
    create: () => {
      const now = new Date().toISOString();
      const draft: InitiativePetitionDraft = {
        draftId: `initiative-petition-draft-${randomUUID()}`,
        initiativeId: initiative.initiativeId,
        authorId: identity.participantId,
        title: "",
        publicSummary: "",
        requestStatement: "",
        expectedOutcome: "",
        supportingContext: "",
        keyArguments: [],
        revisionId: null,
        revisionVersion: null,
        analysisId: null,
        analysisVersion: null,
        proposalIds: [],
        createdAt: now,
        updatedAt: now,
      };

      return upsertInitiativePetitionDraft(draft);
    },
  });
}

/**
 * Initiative Lifecycle — Part F, Section 2 (Petition Sources). The Author
 * Workspace's single entry point: the working draft (auto-provisioned on
 * first use, exactly like Revision's `getOrCreateWorkingRevisionDraft`),
 * the read-only Intelligence Snapshot every "Sources"/"AI Suggestions"
 * panel renders from, and whether a Petition has already been published
 * for this Initiative (Draft becomes unavailable once true).
 */
export async function getInitiativePetitionWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativePetitionDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  // Same visibility rule as public projection — Ready/Draft are not "published".
  // HU-LC-05C.1 — deterministic: the most recently created published Petition.
  const publishedPetition =
    (await listPetitionsByInitiativeId(initiativeId))
      .filter((petition) => isPetitionPubliclyVisible(petition.status))
      .at(-1) ?? null;
  const isPublished = publishedPetition !== null;

  const intelligenceSnapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);
  const draft = isPublished ? null : getOrCreateWorkingPetitionDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    publishedPetitionId: isPublished ? (publishedPetition?.petitionId ?? null) : null,
  };
}

/**
 * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder). Fully
 * recomputes every generated field from the current Intelligence Snapshot
 * — deterministic, never an AI decision — mirroring the Collaborative
 * Analysis Builder's "regenerate, then the Author may still edit and Save"
 * discipline (as opposed to Revision's append-only enrich). The Author's
 * own prior manual edits are only overwritten by an explicit "Generate"
 * click, never silently.
 */
export async function generateInitiativePetitionDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativePetitionDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  const draft = getOrCreateWorkingPetitionDraft(identity, initiative);
  const snapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);
  const generated = await generatePetitionDraftContent(snapshot);

  const updated = updateInitiativePetitionDraft(initiativeId, {
    title: generated.title,
    publicSummary: generated.publicSummary,
    requestStatement: generated.requestStatement,
    expectedOutcome: generated.expectedOutcome,
    supportingContext: generated.supportingContext,
    keyArguments: [...generated.keyArguments],
    revisionId: snapshot.revisionReference?.revisionId ?? null,
    revisionVersion: snapshot.revisionReference?.version ?? null,
    analysisId: snapshot.analysisReference?.analysisId ?? null,
    analysisVersion: snapshot.analysisReference?.initiativeVersion ?? null,
    proposalIds: snapshot.proposalReferences.map((proposal) => proposal.proposalId),
  });

  return updated ?? draft;
}

export function saveInitiativePetitionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativePetitionDraftInput,
): InitiativePetitionDraft {
  const initiative = getOwnedInitiative(initiativeId, identity);

  // Phase 04 — first Save must persist even if workspace open was skipped;
  // lazy init must not publish or advance lifecycle.
  getOrCreateWorkingPetitionDraft(identity, initiative);

  const updated = updateInitiativePetitionDraft(initiativeId, {
    title: input.title,
    publicSummary: input.publicSummary,
    requestStatement: input.requestStatement,
    expectedOutcome: input.expectedOutcome,
    supportingContext: input.supportingContext,
    keyArguments: input.keyArguments,
  });

  if (!updated) {
    throw new Error("Petition draft not found.");
  }

  return updated;
}

function buildTraceability(draft: InitiativePetitionDraft): PetitionTraceability {
  return {
    revisionId: draft.revisionId ?? "",
    revisionVersion: draft.revisionVersion ?? 0,
    proposalIds: [...draft.proposalIds],
    analysisId: draft.analysisId,
    analysisVersion: draft.analysisVersion,
  };
}

/**
 * Initiative Lifecycle — Part F, Section 5/6/9/10. Publishes the working
 * draft as the canonical Public Petition: auto-provisions the bootstrap
 * Collective Decision (see above), creates this draft's own `Petition`
 * (HU-LC-05C.2: never another Petition found by Initiative) via the
 * pre-existing, unmodified Petition state machine with permanent
 * Traceability, transitions it all the
 * way to `Open` (so "Sign Petition" is immediately available — Section 6:
 * "Publishing Petition ... unlocks Decision Session" and Section 7's
 * signature reactions both presuppose the Petition already accepts
 * signatures once published), deletes the consumed Lifecycle draft, and
 * fires exactly one Lifecycle stage publication (Section 10: one
 * notification to every Active Ally, Lifecycle Progress advance, Decision
 * Session unlock).
 */
export async function publishInitiativePetitionStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<Petition> {
  return publishInitiativePetitionDraft(identity, initiativeId, { singlePublication: true });
}

/**
 * HU-LC-05C.2 — publishes the working draft as an additional Petition without the
 * single-Petition guard. Test-only until multi-Petition publishing is enabled;
 * never reachable from a route.
 */
export async function publishAdditionalInitiativePetitionForTests(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<Petition> {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Additional Petition publication is available only when NODE_TEST_ENV=true.");
  }

  return publishInitiativePetitionDraft(identity, initiativeId, { singlePublication: false });
}

/** HU-LC-05C.2 — one draft publishes at most one Petition, with a permanent id. */
export function petitionIdForDraft(draftId: string): string {
  return `petition-${draftId}`;
}

async function publishInitiativePetitionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  options: { readonly singlePublication: boolean },
): Promise<Petition> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  const draft = getInitiativePetitionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Petition draft not found.");
  }

  validateInitiativePetitionDraftForPublication(draft);

  const snapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);

  if (!snapshot.revisionReference || snapshot.revisionReference.revisionId !== draft.revisionId) {
    throw new Error(
      "The Revision this draft was generated from is no longer current. Generate the Petition again before publishing.",
    );
  }

  const petitionId = petitionIdForDraft(draft.draftId);
  const existingPetition = await getPetition(petitionId);

  // The same draft never publishes twice; a Petition it already opened is final.
  if (existingPetition && !RESUMABLE_PUBLICATION_STATUSES.has(existingPetition.status)) {
    throw new Error("This Petition draft has already been published.");
  }

  if (options.singlePublication) {
    const initiativePetitions = await listPetitionsByInitiativeId(initiativeId);

    if (
      initiativePetitions.some(
        (petition) =>
          petition.petitionId !== petitionId && isPetitionPubliclyVisible(petition.status),
      )
    ) {
      throw new Error("A Petition has already been published for this Initiative.");
    }
  }

  // HU-LC-05C.4A.2 — this attempt owns a slot reservation before the Petition
  // exists; only the owner can make it public, within the three-slot limit.
  const reservation = await reservePetitionPublication(initiativeId, petitionId);
  let petition: Petition;

  try {
    injectPetitionSlotFault("crash-after-reserve");

    if (existingPetition) {
      // Retry after a partial failure: resume this draft's own Petition; its
      // content was written at creation and is never rewritten here.
      petition = existingPetition;
    } else {
      const decision = await getOrCreatePetitionBootstrapDecision(
        initiative,
        identity.participantId,
        petitionId,
      );
      petition = await createPetition({
        petitionId,
        collectiveDecisionId: decision.decisionId,
        status: "Draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subject: {
          decisionId: decision.decisionId,
          initiativeId,
          title: draft.title,
          summary: draft.publicSummary,
          requestStatement: draft.requestStatement,
          expectedOutcome: draft.expectedOutcome,
          supportingContext: draft.supportingContext,
          keyArguments: [...draft.keyArguments],
        },
        policy: {
          ...defaultPetitionPolicy,
          withdrawalPolicy: {
            withdrawalPermitted: true,
            withdrawalPolicyDescription:
              "Signatures may be withdrawn at any time while this Petition is open for endorsement.",
          },
        },
        shareLink: null,
        signatures: [],
        supportMetrics: {
          totalSignatures: 0,
          participantSignatures: 0,
          dailyActivity: [],
          supportThresholdStatus: {
            thresholdDefined: false,
            thresholdReached: false,
            currentCount: 0,
            thresholdCount: null,
          },
        },
        outcome: null,
        traceability: buildTraceability(draft),
      });
    }

    if (petition.status === "Draft") {
      petition = (await preparePetition(petitionId)) ?? petition;
    }

    injectPetitionSlotFault("crash-after-prepare");

    if (petition.status === "Ready") {
      if (reservation) {
        await renewPetitionPublicationReservation(reservation);
        petition = await finalizePetitionPublication(reservation);
      } else {
        petition = await publishPetitionInPublishedSlot(petitionId);
      }
    }
  } catch (error) {
    if (reservation && !isSimulatedPublicationCrash(error)) {
      await releasePetitionPublicationReservation(reservation).catch(() => undefined);
    }
    throw error;
  }

  if (petition.status === "Published") {
    petition = (await openPetition(petitionId)) ?? petition;
  }

  if (getInitiativePetitionDraftByInitiativeId(initiativeId)?.draftId === draft.draftId) {
    deleteInitiativePetitionDraft(initiativeId);
  }

  // One publication event per Petition: version = its position among the
  // Initiative's published Petitions (the first Petition keeps version 1).
  const publishedPetitionIds = (await listPetitionsByInitiativeId(initiativeId))
    .filter((entry) => isPetitionPubliclyVisible(entry.status))
    .map((entry) => entry.petitionId);
  const stageVersion = Math.max(1, publishedPetitionIds.indexOf(petitionId) + 1);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "petition",
      stageLabel: "Petition",
      stageArtifactId: petition.petitionId,
      stageVersion,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#petition`,
    });
  } catch (error) {
    console.warn(`[initiative-petition-lifecycle] Lifecycle stage notification skipped: ${String(error)}`);
  }

  return petition;
}
