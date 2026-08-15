import type {
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { resolveStageInstructionSet } from "./lifecycle-ai-stage-instructions.js";

export interface AssistantSpecialization {
  readonly featureLabel: string;
  readonly pageLabel: string;
  readonly specializationSummary: string;
  readonly instructionBlock: string;
  readonly suggestedQuestions: readonly string[];
  readonly stageId: InitiativeLifecycleStageId | null;
  readonly defaultOperations: readonly InitiativeLifecycleAiAssistOperation[];
  readonly canApplySuggestionsToDraft: boolean;
}

const PLATFORM_ORIENTATION_OPS: readonly InitiativeLifecycleAiAssistOperation[] = [
  "explain",
  "answer_question",
];

const AUTHOR_DRAFT_OPS: readonly InitiativeLifecycleAiAssistOperation[] = [
  "explain",
  "summarize_source_themes",
  "identify_missing_information",
  "improve_wording",
  "answer_question",
  "generate_draft",
];

const SURFACE_SPECIALIZATIONS: Record<HumanityUnionAssistantSurfaceId, AssistantSpecialization> = {
  workspace: {
    featureLabel: "Workspace",
    pageLabel: "Workspace",
    specializationSummary: "Help with priorities, next civic actions, and Workspace functions.",
    instructionBlock:
      "Specialize for Workspace. Explain priorities, next civic actions, Initiatives the Participant may steward or follow, notifications entry points, and how Allies and Messages relate — without reading private message content.",
    suggestedQuestions: [
      "What should I review next?",
      "How do Active Allies work?",
      "Explain my current commitments.",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  profile: {
    featureLabel: "Profile",
    pageLabel: "Profile",
    specializationSummary: "Explain Participation Area, public profile choices, and identity basics.",
    instructionBlock:
      "Specialize for Profile / Participation Area. Explain what is public vs private. Never ask for credentials.",
    suggestedQuestions: [
      "What does my Participation Area show?",
      "How do I update my display name?",
      "What is the difference between Participant and Member?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  preferences: {
    featureLabel: "Preferences",
    pageLabel: "Preferences",
    specializationSummary: "Explain notification, language, and privacy preference options.",
    instructionBlock:
      "Specialize for Preferences. Explain how settings affect notifications and presentation without overriding civic eligibility.",
    suggestedQuestions: [
      "How do I change my Preferences?",
      "How do Notifications and Reminders work?",
      "What privacy choices do I have?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  initiatives: {
    featureLabel: "Initiatives",
    pageLabel: "Initiatives",
    specializationSummary: "Help discover, create, and navigate Initiatives.",
    instructionBlock:
      "Specialize for the Initiatives directory. Explain how Initiatives work as the civic root and how to open one.",
    suggestedQuestions: [
      "What is Humanity Union?",
      "How does the Initiative Lifecycle work?",
      "How do I create an Initiative?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  initiative: {
    featureLabel: "Initiative",
    pageLabel: "Initiative",
    specializationSummary: "Orient around one Initiative overview, Discussion, and Lifecycle navigation.",
    instructionBlock:
      "Specialize for a single Initiative overview. Explain Lifecycle navigation, Support signals, Allies, and Discussion entry — without inventing unpublished draft contents.",
    suggestedQuestions: [
      "What is the next Lifecycle stage?",
      "What is an Active Ally?",
      "How does Discussion relate to Analysis?",
    ],
    stageId: "initiative",
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  discussion: {
    featureLabel: "Discussion",
    pageLabel: "Discussion",
    specializationSummary: "Help formulate constructive Discussion contributions.",
    instructionBlock:
      "Specialize for Discussion. Help formulate constructive, evidence-aware comments. Do not invent quote attributions.",
    suggestedQuestions: [
      "How can I write a constructive comment?",
      "What does marking a comment Helpful mean?",
      "When should a comment become a proposal candidate?",
    ],
    stageId: "initiative",
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  analysis: {
    featureLabel: "Collaborative Analysis",
    pageLabel: "Collaborative Analysis",
    specializationSummary: "Analyze themes, evidence, contradictions, and unresolved questions.",
    instructionBlock: resolveStageInstructionSet("analysis"),
    suggestedQuestions: [
      "What evidence is missing?",
      "What questions remain unresolved?",
      "Explain the strongest disagreement.",
    ],
    stageId: "analysis",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  proposal: {
    featureLabel: "Improvement Proposals",
    pageLabel: "Improvement Proposals",
    specializationSummary: "Improve proposal clarity and detect overlap.",
    instructionBlock: resolveStageInstructionSet("proposal"),
    suggestedQuestions: [
      "Is this proposal clear and actionable?",
      "Does this overlap with another proposal?",
      "What evidence should support this proposal?",
    ],
    stageId: "proposal",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  revision: {
    featureLabel: "Revision",
    pageLabel: "Revision",
    specializationSummary: "Improve traceable Initiative changes.",
    instructionBlock: resolveStageInstructionSet("revision"),
    suggestedQuestions: [
      "Are these Revision changes traceable?",
      "What should stay consistent with Analysis?",
      "How do I explain this change neutrally?",
    ],
    stageId: "revision",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  petition: {
    featureLabel: "Petition",
    pageLabel: "Petition",
    specializationSummary: "Clarity, neutrality, and consistency for public endorsement.",
    instructionBlock: resolveStageInstructionSet("petition"),
    suggestedQuestions: [
      "Is this request clear?",
      "Are there unsupported claims?",
      "Make the wording more neutral.",
    ],
    stageId: "petition",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  decision_session: {
    featureLabel: "Decision Session",
    pageLabel: "Decision Session",
    specializationSummary: "Decision completeness, options, and risks — without recommending a vote.",
    instructionBlock: resolveStageInstructionSet("decision_session"),
    suggestedQuestions: [
      "Is the Decision Session framing complete?",
      "What options and risks should be visible?",
      "What is the difference between Decision Session and Collective Decision?",
    ],
    stageId: "decision_session",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  collective_decision: {
    featureLabel: "Collective Decision",
    pageLabel: "Collective Decision",
    specializationSummary: "Actionability and implementation readiness after a decision.",
    instructionBlock: resolveStageInstructionSet("collective_decision"),
    suggestedQuestions: [
      "What happens after a Collective Decision?",
      "How do Commitments follow this decision?",
      "What should remain neutral in the results summary?",
    ],
    stageId: "collective_decision",
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  commitment: {
    featureLabel: "Implementation Commitments",
    pageLabel: "Implementation Commitments",
    specializationSummary: "Responsibilities, resources, and feasibility.",
    instructionBlock: resolveStageInstructionSet("commitment"),
    suggestedQuestions: [
      "Are responsibilities and resources clear?",
      "Where can I see my Commitments?",
      "What makes a Commitment feasible?",
    ],
    stageId: "commitment",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  tracking: {
    featureLabel: "Implementation Tracking",
    pageLabel: "Implementation Tracking",
    specializationSummary: "Delays, dependencies, and evidence gaps.",
    instructionBlock: resolveStageInstructionSet("tracking"),
    suggestedQuestions: [
      "Which commitments may be delayed?",
      "What evidence is missing?",
      "How should blockers be documented?",
    ],
    stageId: "tracking",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  official_response: {
    featureLabel: "Official Responses",
    pageLabel: "Official Responses",
    specializationSummary: "Completeness and source quality for institutional responses.",
    instructionBlock: resolveStageInstructionSet("official_response"),
    suggestedQuestions: [
      "Is this Official Response complete?",
      "What sources should be cited?",
      "How do I keep the wording factual?",
    ],
    stageId: "official_response",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  public_impact: {
    featureLabel: "Public Impact",
    pageLabel: "Public Impact",
    specializationSummary: "Neutrality and evidence for impact summaries.",
    instructionBlock: resolveStageInstructionSet("public_impact"),
    suggestedQuestions: [
      "Which claims need stronger evidence?",
      "What does Public Impact mean?",
      "How do I keep the language neutral?",
    ],
    stageId: "public_impact",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  archive: {
    featureLabel: "Civic Archive",
    pageLabel: "Civic Archive",
    specializationSummary: "Knowledge preservation and lessons learned.",
    instructionBlock: resolveStageInstructionSet("archive"),
    suggestedQuestions: [
      "What lessons should be preserved?",
      "How should the Historical Summary read?",
      "What belongs in Knowledge Contribution?",
    ],
    stageId: "archive",
    defaultOperations: AUTHOR_DRAFT_OPS,
    canApplySuggestionsToDraft: true,
  },
  notifications: {
    featureLabel: "Notifications",
    pageLabel: "Notifications",
    specializationSummary: "Explain what a notification means and what action is available.",
    instructionBlock:
      "Specialize for Notifications. Explain civic alert meaning and available next actions. Never invent notification contents that were not provided.",
    suggestedQuestions: [
      "What does this kind of notification mean?",
      "How do Notifications and Reminders work?",
      "Where do Lifecycle publication alerts appear?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  messages: {
    featureLabel: "Messages",
    pageLabel: "Messages",
    specializationSummary:
      "Explain communication features, privacy, and collaboration tools — never auto-read private history.",
    instructionBlock:
      "Specialize for Messages. Explain Direct Messaging and Initiative Collaboration Channel privacy. Do NOT request or assume private conversation history.",
    suggestedQuestions: [
      "How can I message an Ally?",
      "What is private in Direct Messages?",
      "How does Initiative Group Chat differ from Direct Messages?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
  blog: {
    featureLabel: "Blog",
    pageLabel: "Blog",
    specializationSummary:
      "Explain Humanity Union Blog publishing workflow, authorship, and categories — educational only.",
    instructionBlock:
      "Specialize for the Humanity Union Blog Publishing Domain, Author Access, Editorial Review, and Blog Interaction. Explain what the Blog is, how to become an Author via Workspace Authoring (/workspace/authoring), application statuses, Author/Trusted Author/Editor capabilities, Publishing Workspace, Editorial Review, draft → submit → publish, Safety states (accepted, needs_review, rejected), categories, Blog comments (authenticated Participants only; one-level replies; plain text), Helpful/Not Helpful reactions on publications (not Author scores), and why a comment may be awaiting review. NEVER publish, approve, decline, post comments, react automatically, moderate comments, trigger Safety override, rewrite Author text, approve applications, grant author rights, or bypass Safety or Editor/Admin review. Do not invent Author scores, trust percentages, or reputation metrics. Disagreement and criticism are not Safety violations.",
    suggestedQuestions: [
      "What is the Humanity Union Blog?",
      "How can I become a Blog Author?",
      "What should I write about?",
      "What is Conscious Existence?",
      "Why is my application under review?",
      "Can an Author publish immediately?",
      "What is a Trusted Author?",
      "What should Editors check before publishing?",
      "How is Safety review different from editorial review?",
      "How do Blog comments and replies work?",
      "What do Helpful and Not Helpful mean?",
      "Why is my comment awaiting review?",
    ],
    stageId: null,
    defaultOperations: PLATFORM_ORIENTATION_OPS,
    canApplySuggestionsToDraft: false,
  },
};

export function resolveAssistantSpecialization(
  surfaceId: HumanityUnionAssistantSurfaceId,
): AssistantSpecialization {
  return SURFACE_SPECIALIZATIONS[surfaceId];
}

export function surfaceIdFromLifecycleStage(
  stageId: InitiativeLifecycleStageId,
): HumanityUnionAssistantSurfaceId {
  if (stageId === "initiative") {
    return "initiative";
  }

  return stageId as HumanityUnionAssistantSurfaceId;
}
