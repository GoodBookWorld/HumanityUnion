import type {
  WorkspaceBlockedAction,
  WorkspaceIntelligenceRuleInput,
  WorkspaceSuggestion,
} from "./workspace-intelligence.types.js";
import {
  explainArchiveInitiative,
  explainBeginAnalysis,
  explainCastVote,
  explainCollectiveDecisionNotClosed,
  explainContinueAccountability,
  explainCreateCollectiveDecision,
  explainCreateProposal,
  explainCreatePublicImpact,
  explainDecisionSessionOpen,
  explainDeliverCap,
  explainGenerateCap,
  explainNoParticipationArea,
  explainNotSteward,
  explainOpenRevision,
  explainPendingParticipationTransition,
  explainPrepareDecisionSession,
  explainPublishInitiative,
  explainRecordOfficialResponse,
  explainTrackingIncomplete,
} from "./workspace-intelligence.explanations.js";

function suggestion(partial: WorkspaceSuggestion): WorkspaceSuggestion {
  return partial;
}

function blocked(partial: WorkspaceBlockedAction): WorkspaceBlockedAction {
  return partial;
}

function initiativeRoute(_initiativeId: string): string {
  return "/initiatives";
}

export function evaluatePipelineSuggestions(
  input: WorkspaceIntelligenceRuleInput,
): WorkspaceSuggestion[] {
  const suggestions: WorkspaceSuggestion[] = [];
  const initiative = input.context.initiative;

  if (!initiative) {
    if (!input.context.participationArea.country) {
      suggestions.push(
        suggestion({
          suggestionId: "declare-participation-area",
          title: "Declare Participation Area",
          description: "Declare your civic geography before participating in scoped decisions.",
          reason: "No Participation Area is currently active.",
          relatedEntity: { entityType: "participation_area" },
          relatedRoute: "/member#participation-area",
          priority: "important",
          recommendedAction: "Manage Participation Area",
          constitutionalReference: explainNoParticipationArea(),
        }),
      );
    }

    suggestions.push(
      suggestion({
        suggestionId: "open-initiatives-workspace",
        title: "Open My Initiatives",
        description: "Select an initiative to receive pipeline-specific guidance.",
        reason: "No initiative is selected in the workspace assistant context.",
        relatedEntity: { entityType: "workspace" },
        relatedRoute: "/initiatives",
        priority: "informational",
        recommendedAction: "Open Initiatives",
        constitutionalReference: "Pipeline intelligence requires an initiative context.",
      }),
    );

    return suggestions;
  }

  if (initiative.lifecyclePhase === "draft" && initiative.isSteward) {
    suggestions.push(
      suggestion({
        suggestionId: "publish-initiative",
        title: "Publish Initiative",
        description: "Publish the initiative to begin the collaborative civic pipeline.",
        reason: `Initiative "${initiative.title}" is still in draft.`,
        relatedEntity: {
          entityType: "initiative",
          entityId: initiative.initiativeId,
          title: initiative.title,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "critical",
        recommendedAction: "Publish Initiative",
        constitutionalReference: explainPublishInitiative(),
      }),
    );
  }

  if (
    initiative.lifecyclePhase !== "draft" &&
    !initiative.hasPublishedAnalysis &&
    initiative.isSteward
  ) {
    suggestions.push(
      suggestion({
        suggestionId: "begin-collaborative-analysis",
        title: "Begin Collaborative Analysis",
        description: "Start collaborative analysis for this published initiative.",
        reason: "No published collaborative analysis exists yet.",
        relatedEntity: {
          entityType: "initiative",
          entityId: initiative.initiativeId,
          title: initiative.title,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Begin Collaborative Analysis",
        constitutionalReference: explainBeginAnalysis(),
      }),
    );
  }

  if (initiative.hasPublishedAnalysis && !initiative.hasSubmittedProposal) {
    suggestions.push(
      suggestion({
        suggestionId: "create-improvement-proposal",
        title: "Create Improvement Proposal",
        description: "Submit an improvement proposal based on the published analysis.",
        reason: "Analysis exists but no submitted proposal was found.",
        relatedEntity: {
          entityType: "analysis",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Create Improvement Proposal",
        constitutionalReference: explainCreateProposal(),
      }),
    );
  }

  if (initiative.hasAcceptedProposal && !initiative.hasPublishedRevision && initiative.isSteward) {
    suggestions.push(
      suggestion({
        suggestionId: "open-revision",
        title: "Open Revision",
        description: "Incorporate accepted proposals through an initiative revision.",
        reason: "Accepted proposals exist without a published revision.",
        relatedEntity: {
          entityType: "initiative_revision",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Open Revision",
        constitutionalReference: explainOpenRevision(),
      }),
    );
  }

  if (
    initiative.hasPublishedRevision &&
    !initiative.hasClosedDecisionSession &&
    initiative.isSteward
  ) {
    suggestions.push(
      suggestion({
        suggestionId: "prepare-decision-session",
        title: "Prepare Decision Session",
        description: "Prepare and publish a decision session for this initiative.",
        reason: "A published revision exists but no closed decision session was found.",
        relatedEntity: {
          entityType: "decision_session",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Prepare Decision Session",
        constitutionalReference: explainPrepareDecisionSession(),
      }),
    );
  }

  if (
    initiative.hasClosedDecisionSession &&
    !initiative.hasClosedCollectiveDecision &&
    initiative.isSteward
  ) {
    suggestions.push(
      suggestion({
        suggestionId: "create-collective-decision",
        title: "Create Collective Decision",
        description: "Create a collective decision after the decision session closes.",
        reason: "Decision session is closed and no closed collective decision exists.",
        relatedEntity: {
          entityType: "collective_decision",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "critical",
        recommendedAction: "Create Collective Decision",
        constitutionalReference: explainCreateCollectiveDecision(),
      }),
    );
  }

  if (
    initiative.hasOpenCollectiveDecision &&
    initiative.participantEligibleToVote &&
    !initiative.participantHasVote
  ) {
    suggestions.push(
      suggestion({
        suggestionId: "cast-vote",
        title: "Cast your vote",
        description:
          initiative.openDecisionQuestion ?? "Participate in the open collective decision.",
        reason: "You are eligible and have not yet cast a vote.",
        relatedEntity: {
          entityType: "collective_decision",
          entityId: initiative.openDecisionId,
          title: initiative.openDecisionQuestion,
        },
        relatedRoute: initiative.openDecisionId
          ? `/collective-decisions/public/${encodeURIComponent(initiative.openDecisionId)}`
          : initiativeRoute(initiative.initiativeId),
        priority: "critical",
        recommendedAction: "Cast your vote",
        constitutionalReference: explainCastVote(),
      }),
    );
  }

  if (
    initiative.hasClosedCollectiveDecision &&
    !initiative.hasCivicActionPackage &&
    initiative.isSteward
  ) {
    suggestions.push(
      suggestion({
        suggestionId: "generate-cap",
        title: "Generate Civic Action Package",
        description: "Generate a Civic Action Package from the closed collective decision.",
        reason: "Collective decision is closed and no CAP exists.",
        relatedEntity: {
          entityType: "civic_action_package",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Generate Civic Action Package",
        constitutionalReference: explainGenerateCap(),
      }),
    );
  }

  if (initiative.hasCivicActionPackage && !initiative.hasDelivery && initiative.isSteward) {
    suggestions.push(
      suggestion({
        suggestionId: "deliver-cap",
        title: "Deliver Civic Action Package",
        description: "Record delivery of the Civic Action Package.",
        reason: "A CAP exists but no sent delivery record was found.",
        relatedEntity: {
          entityType: "civic_action_package",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "important",
        recommendedAction: "Deliver Civic Action Package",
        constitutionalReference: explainDeliverCap(),
      }),
    );
  }

  if (initiative.hasDelivery && !initiative.hasOfficialResponse) {
    suggestions.push(
      suggestion({
        suggestionId: "record-official-response",
        title: "Record Official Response when received",
        description: "Document an official response after delivery.",
        reason: "Delivery exists without a published official response.",
        relatedEntity: {
          entityType: "official_response",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "normal",
        recommendedAction: "Record Official Response",
        constitutionalReference: explainRecordOfficialResponse(),
      }),
    );
  }

  if (initiative.hasOfficialResponse && initiative.hasActiveAccountability) {
    suggestions.push(
      suggestion({
        suggestionId: "continue-accountability",
        title: "Continue Accountability Timeline",
        description: "Add accountability events to the active timeline.",
        reason: "An active accountability record requires follow-up.",
        relatedEntity: {
          entityType: "civic_accountability",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "normal",
        recommendedAction: "Continue Accountability Timeline",
        constitutionalReference: explainContinueAccountability(),
      }),
    );
  }

  if (initiative.hasCompletedTracking && !initiative.hasPublishedImpact && initiative.isSteward) {
    suggestions.push(
      suggestion({
        suggestionId: "create-public-impact",
        title: "Create Public Impact",
        description: "Publish public impact after implementation tracking completes.",
        reason: "Tracking is complete and no published public impact exists.",
        relatedEntity: {
          entityType: "public_impact",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "normal",
        recommendedAction: "Create Public Impact",
        constitutionalReference: explainCreatePublicImpact(),
      }),
    );
  }

  if (initiative.hasVerifiedImpact && !initiative.hasPublishedArchive && initiative.isSteward) {
    suggestions.push(
      suggestion({
        suggestionId: "archive-initiative",
        title: "Archive this initiative",
        description: "Publish a civic archive record after impact verification.",
        reason: "Public impact is verified and no published archive exists.",
        relatedEntity: {
          entityType: "civic_archive",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "informational",
        recommendedAction: "Archive this initiative",
        constitutionalReference: explainArchiveInitiative(),
      }),
    );
  }

  return suggestions;
}

export function evaluateBlockedActions(
  input: WorkspaceIntelligenceRuleInput,
): WorkspaceBlockedAction[] {
  const blockedActions: WorkspaceBlockedAction[] = [];
  const initiative = input.context.initiative;

  if (input.context.participationArea.hasPendingTransition) {
    blockedActions.push(
      blocked({
        actionId: "participation-transition-pending",
        title: "Participation Area change pending",
        reason: "Your declared Participation Area change is not effective yet.",
        blockedBy: "Pending Participation Area transition",
        constitutionalReference: explainPendingParticipationTransition(),
        relatedRoute: "/member#participation-area",
      }),
    );
  }

  if (!input.context.participationArea.country) {
    blockedActions.push(
      blocked({
        actionId: "missing-participation-area",
        title: "Scoped decision participation blocked",
        reason: "No active Participation Area is declared.",
        blockedBy: "Missing Participation Area",
        constitutionalReference: explainNoParticipationArea(),
        relatedRoute: "/member#participation-area",
      }),
    );
  }

  if (!initiative) {
    return blockedActions;
  }

  if (!initiative.isSteward) {
    blockedActions.push(
      blocked({
        actionId: "not-steward",
        title: "Steward actions unavailable",
        reason: "You are not the steward of this initiative.",
        blockedBy: "Not steward",
        constitutionalReference: explainNotSteward(),
        relatedRoute: initiativeRoute(initiative.initiativeId),
      }),
    );
  }

  if (initiative.hasOpenDecisionSession && !initiative.hasClosedCollectiveDecision) {
    blockedActions.push(
      blocked({
        actionId: "decision-session-open",
        title: "Collective Decision creation blocked",
        reason: "The Decision Session is still open.",
        blockedBy: "Decision Session still open",
        constitutionalReference: explainDecisionSessionOpen(),
        relatedRoute: initiativeRoute(initiative.initiativeId),
      }),
    );
  }

  if (initiative.hasOpenCollectiveDecision && !initiative.hasClosedCollectiveDecision) {
    blockedActions.push(
      blocked({
        actionId: "collective-decision-open",
        title: "Civic Action Package generation blocked",
        reason: "The Collective Decision is still open for voting.",
        blockedBy: "Collective Decision not yet closed",
        constitutionalReference: explainCollectiveDecisionNotClosed(),
        relatedRoute: initiative.openDecisionId
          ? `/collective-decisions/public/${encodeURIComponent(initiative.openDecisionId)}`
          : initiativeRoute(initiative.initiativeId),
      }),
    );
  }

  if (initiative.hasActiveTracking && !initiative.hasCompletedTracking) {
    blockedActions.push(
      blocked({
        actionId: "tracking-incomplete",
        title: "Public Impact creation blocked",
        reason: "Implementation tracking is still active.",
        blockedBy: "Tracking incomplete",
        constitutionalReference: explainTrackingIncomplete(),
        relatedRoute: initiativeRoute(initiative.initiativeId),
      }),
    );
  }

  if (
    initiative.hasOpenCollectiveDecision &&
    !initiative.participantEligibleToVote &&
    !initiative.isSteward
  ) {
    blockedActions.push(
      blocked({
        actionId: "not-eligible-to-vote",
        title: "Vote casting unavailable",
        reason:
          "You are not eligible for this collective decision under current Participation Area rules.",
        blockedBy: "Not eligible",
        constitutionalReference: explainCastVote(),
        relatedRoute: initiative.openDecisionId
          ? `/collective-decisions/public/${encodeURIComponent(initiative.openDecisionId)}`
          : initiativeRoute(initiative.initiativeId),
      }),
    );
  }

  return blockedActions;
}

export function evaluateSectionSuggestions(
  input: WorkspaceIntelligenceRuleInput,
): WorkspaceSuggestion[] {
  const section = input.context.currentSection.toLowerCase();
  const initiative = input.context.initiative;
  const suggestions: WorkspaceSuggestion[] = [];

  if (section.includes("participation")) {
    suggestions.push(
      suggestion({
        suggestionId: "section-participation-area",
        title: "Manage Participation Area",
        description: "Review or update your declared civic geography.",
        reason: "You are viewing the Participation Area workspace section.",
        relatedEntity: { entityType: "participation_area" },
        relatedRoute: "/member#participation-area",
        priority: "normal",
        recommendedAction: "Manage Participation Area",
        constitutionalReference: "Participation Area determines scoped decision eligibility.",
      }),
    );
  }

  if (section.includes("profile") || section.includes("member")) {
    suggestions.push(
      suggestion({
        suggestionId: "section-member-profile",
        title: "Edit Profile",
        description: "Update your member profile and privacy settings.",
        reason: "You are viewing the Member Profile workspace section.",
        relatedEntity: { entityType: "member_profile" },
        relatedRoute: "/member",
        priority: "informational",
        recommendedAction: "Edit Profile",
        constitutionalReference: "Member profile controls workspace identity and privacy.",
      }),
    );
  }

  if (initiative && section.includes("decision session")) {
    suggestions.push(
      suggestion({
        suggestionId: "section-decision-session",
        title: "Open Decision Session",
        description: "Review the decision session workspace for this initiative.",
        reason: "Section-specific guidance for Decision Session.",
        relatedEntity: {
          entityType: "decision_session",
          entityId: initiative.initiativeId,
        },
        relatedRoute: initiativeRoute(initiative.initiativeId),
        priority: "normal",
        recommendedAction: "Open Decision Session",
        constitutionalReference: explainPrepareDecisionSession(),
      }),
    );
  }

  return suggestions;
}
