import type { InitiativeLifecycleAuthorAction } from "./initiative-lifecycle-author-action.js";
import type {
  InitiativeLifecyclePresentationMode,
  InitiativeLifecycleViewerRole,
} from "./initiative-lifecycle-presentation.js";
import type { InitiativeLifecycleSourceSnapshotSummary } from "./initiative-lifecycle-source-snapshot.js";
import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";
import type { InitiativeLifecycleStageMetadata } from "./initiative-lifecycle-stage-metadata.js";

/**
 * Initiative Lifecycle — Part A Completion Part 2: the smallest read
 * projection the shared {@link InitiativeLifecycleStageWorkspace} shell
 * needs to render exactly one selected stage.
 *
 * Deliberately NOT `PublicInitiativeExperienceProjection` (which loads
 * `stageContent` for all twelve stages on every request) — this projection
 * loads the Initiative once, resolves the viewer's role once, and fetches
 * only the selected stage's own domain data. Existing stage domains
 * (Collaborative Analysis, Improvement Proposals, Petition, …) remain the
 * sole source of truth; this is a read-only presentation composition over
 * them, never a new persisted aggregate.
 */

/**
 * AI capability flags available for the selected stage's Author Workspace.
 * Each flag must stay false until a real callable operation exists behind
 * {@link InitiativeLifecycleAiAssistOperation} (no fake buttons).
 */
export interface InitiativeLifecycleAiCapabilities {
  readonly canGenerateDraft: boolean;
  readonly canRegenerateSection: boolean;
  readonly canImproveWording: boolean;
  readonly canIdentifyGaps: boolean;
  readonly canIdentifyContradictions: boolean;
  readonly canSummarize: boolean;
  readonly canExplain: boolean;
  readonly canAnswerQuestions: boolean;
}

export interface InitiativeLifecycleStageNeighbor {
  readonly stageId: InitiativeLifecycleStageId;
  readonly label: string;
  readonly hash: string;
}

export interface InitiativeLifecycleStageProjection {
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  readonly stageOrder: number;
  readonly stageHash: string;
  readonly viewerRole: InitiativeLifecycleViewerRole;
  readonly presentationMode: InitiativeLifecyclePresentationMode;
  readonly metadata: InitiativeLifecycleStageMetadata;
  readonly sourceSnapshot: InitiativeLifecycleSourceSnapshotSummary;
  /** Empty for viewers who are not the Author — the shell never receives Author actions it must then hide itself. */
  readonly authorActions: readonly InitiativeLifecycleAuthorAction[];
  readonly aiCapabilities: InitiativeLifecycleAiCapabilities;
  readonly previousStage: InitiativeLifecycleStageNeighbor | null;
  readonly nextStage: InitiativeLifecycleStageNeighbor | null;
  /** Stable deep link for this Initiative + stage, in the existing public hash-route format. */
  readonly publicDeepLink: string;
  readonly generatedAt: string;
}
