import type {
  Achievement,
  CollectiveDecision,
  Evidence,
  Implementation,
  ImplementationCommitment,
  ImplementationPhase,
  Initiative,
  Petition,
  PublicAchievementProjection,
  PublicCollectiveProgressProjection,
  PublicCollectiveDecisionReference,
  PublicCompletionProjection,
  PublicCurrentPhaseProjection,
  PublicEvidenceProjection,
  PublicImplementationCommitmentReference,
  PublicImplementationHumanityAssistantPanel,
  PublicImplementationIdentity,
  PublicImplementationPhaseProjection,
  PublicImplementationProjection,
  PublicImplementationShareReference,
  PublicImplementationStatusProjection,
  PublicInitiativeContext,
  PublicPetitionReference,
  PublicRegistrationGatewayGuidance,
} from "@hu/types";

import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getImplementationCommitment } from "../implementation-commitment/implementation-commitment.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetition } from "../petition/petition.store.js";

const VIEWING_NOTE = "Viewing this page does not record achievements or change collective progress.";
const SHARING_NOTE =
  "Sharing increases visibility but does not record accomplishment or assign work.";
const NOT_REAPPROVAL_STATEMENT =
  "Implementation completion is derived from recorded achievements — not Collective Decision re-approval.";
const DERIVED_VALUE_NOTE =
  "This value is derived from recorded collective achievements and milestone satisfaction.";

function getRecordingStatusSummary(status: Implementation["status"]): string {
  switch (status) {
    case "Planned":
      return "Preparing implementation structure and references";
    case "Started":
      return "Opened for collective execution recording";
    case "InProgress":
      return "Active — collective achievements are being recorded";
    case "Completed":
      return "Execution record closed successfully";
    case "Archived":
      return "Archived historical record";
    default:
      return status;
  }
}

function getLifecycleStatusLabel(status: Implementation["status"]): string {
  switch (status) {
    case "InProgress":
      return "In Progress";
    default:
      return status;
  }
}

function isShareAvailable(status: Implementation["status"]): boolean {
  return status !== "Planned";
}

function sortPhases(phases: ImplementationPhase[]): ImplementationPhase[] {
  return [...phases].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
}

function mapPhase(phase: ImplementationPhase): PublicImplementationPhaseProjection {
  return {
    implementationPhaseId: phase.implementationPhaseId,
    title: phase.title,
    summary: phase.summary,
    status: phase.status,
    sequenceOrder: phase.sequenceOrder,
  };
}

function buildCurrentPhaseProjection(implementation: Implementation): PublicCurrentPhaseProjection {
  const ordered = sortPhases(implementation.implementationPhases);
  const completedPhases = ordered.filter((phase) => phase.status === "Complete").map(mapPhase);
  const upcomingPhases = ordered.filter((phase) => phase.status !== "Complete").map(mapPhase);
  const currentPhase = upcomingPhases[0] ?? completedPhases.at(-1) ?? null;

  return {
    currentPhase,
    completedPhases,
    upcomingPhases,
  };
}

function buildApprovedResultSummary(decision: CollectiveDecision | null): string | null {
  if (!decision?.decisionResult?.winningOptionId) {
    return null;
  }

  const winningOption = decision.ballot.options.find(
    (option) => option.optionId === decision.decisionResult?.winningOptionId,
  );

  return winningOption?.label ?? null;
}

function buildInitiativeContext(
  implementation: Implementation,
  initiative: Initiative | null,
): PublicInitiativeContext {
  return {
    initiativeId: implementation.initiativeId,
    title: initiative?.title ?? implementation.subjectTitle,
    summary: initiative?.description ?? implementation.subjectSummary,
  };
}

function buildCollectiveDecisionReference(
  implementation: Implementation,
  decision: CollectiveDecision | null,
): PublicCollectiveDecisionReference {
  const decisionSummary = decision?.ballot.question ?? null;
  const approvedOutcomeSummary = decision?.outcome?.explanation ?? null;
  const approvedResultSummary = buildApprovedResultSummary(decision);

  return {
    collectiveDecisionId: implementation.collectiveDecisionId,
    decisionSummary,
    approvedOutcomeSummary,
    approvedResultSummary,
    contextAvailable: Boolean(decisionSummary || approvedOutcomeSummary || approvedResultSummary),
  };
}

function buildPetitionReference(
  implementation: Implementation,
  petition: Petition | null,
): PublicPetitionReference {
  return {
    petitionId: implementation.petitionId,
    summaryStatement: petition?.subject.summary ?? implementation.subjectSummary,
    endorsementContextNote:
      "Public Petition endorsement expresses support. It is separate from implementation execution recording.",
    contextAvailable: petition !== null,
  };
}

function buildImplementationCommitmentReference(
  implementation: Implementation,
  commitment: ImplementationCommitment | null,
): PublicImplementationCommitmentReference {
  return {
    implementationCommitmentId: implementation.implementationCommitmentId,
    summaryStatement:
      commitment?.subjectSummary ??
      "Implementation Commitment recorded declared preparedness before collective execution.",
    contextNote:
      "Commitment readiness preceded implementation recording. Individual declarations and contribution detail are not exposed publicly.",
    contextAvailable: commitment !== null,
  };
}

function buildImplementationIdentity(implementation: Implementation): PublicImplementationIdentity {
  return {
    implementationId: implementation.implementationId,
    title: implementation.subjectTitle,
    summary: implementation.subjectSummary,
    lifecycleStatus: implementation.status,
    recordingStatusSummary: getRecordingStatusSummary(implementation.status),
  };
}

function buildImplementationStatus(
  implementation: Implementation,
): PublicImplementationStatusProjection {
  const progressClaimsProvisional =
    implementation.status === "Planned" || implementation.status === "Started";

  return {
    lifecycleStatus: implementation.status,
    lifecycleStatusLabel: getLifecycleStatusLabel(implementation.status),
    recordingStatusSummary: getRecordingStatusSummary(implementation.status),
    progressClaimsProvisional,
    derivedProgressHeadline: implementation.progressIndicator.headline,
    derivedCompletionHeadline: implementation.completionIndicator.headline,
  };
}

function buildCollectiveProgress(
  implementation: Implementation,
): PublicCollectiveProgressProjection {
  const { collectiveProgress, progressIndicator } = implementation;

  return {
    aggregateProgressSummary: collectiveProgress.aggregateProgressSummary,
    progressIndicatorHeadline: progressIndicator.headline,
    requiredMilestoneProgressLabel: progressIndicator.requiredMilestoneProgressLabel,
    completedPhaseCount: collectiveProgress.completedPhaseCount,
    completedMilestoneCount: collectiveProgress.completedMilestoneCount,
    requiredMilestonesSatisfiedCount: collectiveProgress.requiredMilestonesSatisfiedCount,
    requiredMilestonesTotalCount: collectiveProgress.requiredMilestonesTotalCount,
    optionalMilestonesSatisfiedCount: collectiveProgress.optionalMilestonesSatisfiedCount,
    totalAchievements: collectiveProgress.totalAchievements,
    derivedAt: collectiveProgress.derivedAt,
    derivedValueNote: DERIVED_VALUE_NOTE,
  };
}

function getPhaseTitle(
  implementation: Implementation,
  phaseId: string | undefined,
): string | null {
  if (!phaseId) {
    return null;
  }

  return (
    implementation.implementationPhases.find((phase) => phase.implementationPhaseId === phaseId)
      ?.title ?? null
  );
}

function buildPublicAchievements(implementation: Implementation): PublicAchievementProjection[] {
  return [...implementation.achievements]
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .map((achievement: Achievement) => {
      const milestone = implementation.milestones.find(
        (entry) => entry.milestoneId === achievement.milestoneId,
      );

      return {
        achievementId: achievement.achievementId,
        title: achievement.title,
        summary: achievement.summary,
        milestoneId: achievement.milestoneId,
        milestoneTitle: milestone?.title ?? achievement.milestoneId,
        phaseTitle: getPhaseTitle(implementation, milestone?.implementationPhaseId),
        recordedAt: achievement.recordedAt,
        evidenceAvailable: implementation.evidence.some(
          (entry) => entry.achievementId === achievement.achievementId,
        ),
      };
    });
}

function buildPublicEvidence(implementation: Implementation): PublicEvidenceProjection[] {
  const achievementTitles = new Map(
    implementation.achievements.map((achievement) => [achievement.achievementId, achievement.title]),
  );

  return [...implementation.evidence]
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .map((entry: Evidence) => ({
      evidenceId: entry.evidenceId,
      label: entry.label,
      evidenceKind: entry.evidenceKind,
      achievementId: entry.achievementId,
      achievementTitle: achievementTitles.get(entry.achievementId) ?? entry.achievementId,
      recordedAt: entry.recordedAt,
      referenceDisplayLabel: entry.reference?.displayLabel ?? null,
      linkDisplayLabel: entry.link?.displayLabel ?? null,
      attachmentDisplayLabel: entry.attachment?.displayLabel ?? null,
    }));
}

function buildCompletion(implementation: Implementation): PublicCompletionProjection {
  const { completion, completionAssessment, completionIndicator } = implementation;
  const remainingRequiredMilestoneDescriptions = implementation.milestones
    .filter(
      (milestone) =>
        milestone.requirementType === "Required" && milestone.status !== "Satisfied",
    )
    .map((milestone) => milestone.description || milestone.title);

  return {
    completionReached: completion.completionReached,
    assessmentReached: completionAssessment.assessmentReached,
    completionHeadline: completionIndicator.headline,
    requiredCriteriaProgressLabel: completionIndicator.requiredCriteriaProgressLabel,
    explanation: completion.explanation,
    assessmentExplanation: completionAssessment.explanation,
    remainingRequiredMilestoneDescriptions,
    satisfiedRequiredMilestoneCount: completionAssessment.satisfiedCriteria.length,
    totalRequiredMilestoneCount:
      completionAssessment.satisfiedCriteria.length +
      completionAssessment.unsatisfiedCriteria.length,
    notReapprovalStatement: NOT_REAPPROVAL_STATEMENT,
    derivedAt: completion.derivedAt,
    derivedValueNote: DERIVED_VALUE_NOTE,
  };
}

function buildShareReference(implementation: Implementation): PublicImplementationShareReference {
  const available = isShareAvailable(implementation.status);

  return {
    url: available ? `/implementations/public/${implementation.implementationId}` : null,
    available,
    sharingNote: SHARING_NOTE,
  };
}

function buildRegistrationGateway(
  implementation: Implementation,
): PublicRegistrationGatewayGuidance {
  const observationAvailable = true;
  const recordingAvailable =
    implementation.status === "Started" || implementation.status === "InProgress";

  let entryIntent = "Observe this public implementation record.";
  let registrationGatewayMessage =
    "You may read and share this page without registration. Registration is required before achievements may be recorded in the operational workspace.";

  if (recordingAvailable) {
    entryIntent =
      "Register to continue toward accountable recording in the Implementation Workspace when you choose to.";
    registrationGatewayMessage =
      "Registration is required before achievements can be recorded. After registration, continue in the operational workspace if you choose to record collective accomplishment.";
  } else if (implementation.status === "Planned") {
    entryIntent = "Observe and share while implementation structure prepares on the operational side.";
    registrationGatewayMessage =
      "You may observe and share without registration. Achievement recording becomes available when implementation recording is active.";
  } else if (implementation.status === "Completed" || implementation.status === "Archived") {
    entryIntent = "Review the public execution record.";
    registrationGatewayMessage =
      "This implementation record is closed. The public record remains available for observation and sharing.";
  }

  return {
    registrationRequired: true,
    declarationAvailable: recordingAvailable,
    observationAvailable,
    entryIntent,
    registrationGatewayMessage,
    viewingNote: VIEWING_NOTE,
    sharingNote: SHARING_NOTE,
    workspacePath: `/implementations/${implementation.implementationId}`,
  };
}

function buildHumanityAssistantPanel(
  implementation: Implementation,
  completion: PublicCompletionProjection,
  progress: PublicCollectiveProgressProjection,
): PublicImplementationHumanityAssistantPanel {
  const achievementCount = implementation.achievements.length;
  const evidenceCount = implementation.evidence.length;

  const achievementExplanation =
    achievementCount > 0
      ? `${achievementCount} public collective achievement(s) are recorded. Achievements describe collective accomplishment — not personal task completion.`
      : "No public achievements have been recorded for this implementation yet.";

  const evidenceExplanation =
    evidenceCount > 0
      ? `${evidenceCount} public evidence item(s) support recorded achievements. Evidence supports transparency — it does not establish objective truth.`
      : achievementCount > 0
        ? "Achievements are recorded. Public supporting material may appear when attached and approved for display."
        : "No public evidence has been attached to recorded achievements.";

  const progressExplanation =
    implementation.status === "Planned" || implementation.status === "Started"
      ? "Public progress will appear when collective achievements are recorded during active implementation."
      : `${progress.progressIndicatorHeadline} ${progress.requiredMilestoneProgressLabel}`;

  const completionExplanation =
    implementation.status === "Planned" || implementation.status === "Started"
      ? "Public completion assessment will appear when implementation recording is active."
      : `${completion.completionHeadline} ${completion.notReapprovalStatement}`;

  return {
    summary:
      "This informational panel explains public implementation progress. It does not decide, persuade, coordinate or record achievements on your behalf.",
    progressExplanation,
    achievementExplanation,
    evidenceExplanation,
    completionExplanation,
    boundaryStatement:
      "The assistant never approves achievements, coordinates implementation, recommends work or modifies collective progress.",
  };
}

export function toPublicImplementationProjection(
  implementation: Implementation,
): PublicImplementationProjection | null {
  if (!implementation.implementationId) {
    return null;
  }

  const decision = getDecision(implementation.collectiveDecisionId);
  const initiative = getInitiativeById(implementation.initiativeId);
  const petition = getPetition(implementation.petitionId);
  const commitment = getImplementationCommitment(implementation.implementationCommitmentId);

  const collectiveProgress = buildCollectiveProgress(implementation);
  const completion = buildCompletion(implementation);

  return {
    implementationIdentity: buildImplementationIdentity(implementation),
    initiativeContext: buildInitiativeContext(implementation, initiative),
    collectiveDecisionReference: buildCollectiveDecisionReference(implementation, decision),
    petitionReference: buildPetitionReference(implementation, petition),
    implementationCommitmentReference: buildImplementationCommitmentReference(
      implementation,
      commitment,
    ),
    implementationStatus: buildImplementationStatus(implementation),
    collectiveProgress,
    currentPhase: buildCurrentPhaseProjection(implementation),
    achievements: buildPublicAchievements(implementation),
    evidence: buildPublicEvidence(implementation),
    completion,
    shareReference: buildShareReference(implementation),
    registrationGateway: buildRegistrationGateway(implementation),
    humanityAssistant: buildHumanityAssistantPanel(implementation, completion, collectiveProgress),
  };
}
