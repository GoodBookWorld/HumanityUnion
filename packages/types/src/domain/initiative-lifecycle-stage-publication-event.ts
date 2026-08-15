import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/**
 * Initiative Lifecycle — Part A Part 13: universal stage publication event
 * contract.
 *
 * `"published"` / `"opened"` / `"finalized"` / `"fixed"` map to the exact
 * wording each existing domain already uses for its own "this stage's
 * result is now final and public" transition (publish, open, close/finalize,
 * verify). `"superseded"` / `"archived"` cover the rarer terminal
 * transitions (a later revision supersedes an earlier one; the Civic
 * Archive record itself is published). This event never replaces a
 * domain's own event (e.g. `analysis_published`, `decision_opened`); it is
 * raised *in addition to* that, purely to drive the universal Active Ally
 * notification fan-out (Part 14) and any future cross-stage automation.
 */
export type InitiativeLifecycleStagePublicationKind =
  | "published"
  | "opened"
  | "finalized"
  | "fixed"
  | "superseded"
  | "archived";

export interface InitiativeLifecycleStagePublicationEvent {
  readonly eventId: string;
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  /** The owning domain's own record id for the published artifact (e.g. analysisId, proposalId). */
  readonly stageArtifactId: string;
  /** The owning domain's own version/round number at the moment of this publication, when it has one. */
  readonly stageVersion: number;
  readonly actorParticipantId: string;
  readonly occurredAt: string;
  readonly publicationKind: InitiativeLifecycleStagePublicationKind;
  /** Deep-link to the published result — always the existing canonical stage route/hash, never a new route. */
  readonly relatedUrl: string;
}
