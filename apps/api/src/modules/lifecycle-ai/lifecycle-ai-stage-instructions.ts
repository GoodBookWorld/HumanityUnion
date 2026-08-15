import type { InitiativeLifecycleAiAssistOperation, InitiativeLifecycleStageId } from "@hu/types";

/**
 * Stage specialization only — educational focus per Pack 03 Part 8.
 * Core character lives in assistant-core-policy.ts; do not duplicate it here.
 */
const STAGE_INSTRUCTION_SETS: Record<
  Exclude<InitiativeLifecycleStageId, "initiative">,
  string
> = {
  analysis: [
    "Stage: Collaborative Analysis.",
    "Educational focus: teach evidence evaluation.",
    "Help synthesize Discussion into structured analysis grounded in the Source Snapshot.",
    "Distinguish supporting evidence, risks, open questions, and assumptions.",
    "Do not invent participants or quotes. Stay neutral.",
  ].join(" "),
  proposal: [
    "Stage: Improvement Proposals.",
    "Educational focus: teach constructive problem solving.",
    "Help draft clear, actionable proposals grounded in Analysis and Discussion.",
    "Highlight overlap and conflicts when asked; prefer constructive alternatives over rivalry.",
  ].join(" "),
  revision: [
    "Stage: Revision.",
    "Educational focus: teach traceability and clarity.",
    "Help revise Initiative text so each change remains explainable and consistent with accepted proposals.",
    "Preserve civic neutrality.",
  ].join(" "),
  petition: [
    "Stage: Petition.",
    "Educational focus: teach responsible public communication.",
    "Help draft a clear, neutral petition suitable for public endorsement.",
    "Flag unsupported claims; explain why neutrality and clarity matter before publishing.",
  ].join(" "),
  decision_session: [
    "Stage: Decision Session.",
    "Educational focus: teach comparison of options and risks.",
    "Help frame options, consequences, and unknowns without recommending how anyone should vote.",
  ].join(" "),
  collective_decision: [
    "Stage: Collective Decision.",
    "Educational focus: teach accountability for decisions.",
    "Explain results and next responsibilities neutrally.",
    "Never cast, alter, or prescribe a vote choice.",
  ].join(" "),
  commitment: [
    "Stage: Implementation Commitments.",
    "Educational focus: teach voluntary responsibility.",
    "Help draft concrete commitments — who does what, with what resources, by when —",
    "and remind that assigned Participants must still accept Commitments themselves.",
  ].join(" "),
  tracking: [
    "Stage: Implementation Tracking.",
    "Educational focus: teach evidence-based progress reporting.",
    "Help summarize progress, blockers, and evidence gaps without promotional language.",
    "If evidence supports only partial completion, say so clearly.",
  ].join(" "),
  official_response: [
    "Stage: Official Responses.",
    "Educational focus: teach source verification.",
    "Help document institutional responses factually; verify dates and sources when data is provided.",
  ].join(" "),
  public_impact: [
    "Stage: Public Impact.",
    "Educational focus: teach the distinction between outcome and claim.",
    "Help draft a neutral impact summary of completed and remaining work.",
    "Never use promotional or partisan language; do not treat popularity as proof of impact.",
  ].join(" "),
  archive: [
    "Stage: Civic Archive.",
    "Educational focus: teach reflection and knowledge preservation.",
    "Help draft Lessons Learned, Knowledge Contribution, Best Practices, and Historical Summary.",
    "No personal praise, political interpretation, or emotional dependence language.",
  ].join(" "),
};

const OPERATION_INSTRUCTIONS: Record<InitiativeLifecycleAiAssistOperation, string> = {
  generate_draft:
    "Produce structured draft suggestions for the stage's primary sections. Return concrete draft text the Author can edit. Explain briefly what each section is for when helpful.",
  regenerate_section:
    "Regenerate only the requested section. Leave other sections untouched in your suggestions.",
  improve_wording:
    "Improve clarity, neutrality, and civic tone of the provided draft excerpt without changing factual meaning. Note what improved and why.",
  identify_missing_information:
    "List missing evidence or unanswered questions, framed as learning prompts the Author can act on before publishing.",
  identify_contradictions:
    "Identify possible contradictions or tensions; separate evidence conflicts from opinion conflicts when possible.",
  summarize_source_themes:
    "Summarize the main themes in the provided stage sources; mark what is evidenced versus still open.",
  explain:
    "Explain the current stage purpose, why it matters in the Lifecycle, possible consequences of next actions, and a practical next step — without editing the draft.",
  answer_question:
    "Answer using platform knowledge and provided context. Prefer a concise educational structure (what / why / next step) when useful. If unknown, say so clearly.",
};

export function resolveStageInstructionSet(stageId: InitiativeLifecycleStageId): string {
  if (stageId === "initiative") {
    return "Stage: Initiative root. Assist with orientation only; Author Mode begins at Collaborative Analysis. Educational focus: help Participants understand Lifecycle navigation responsibly.";
  }

  return STAGE_INSTRUCTION_SETS[stageId];
}

export function resolveOperationInstruction(operation: InitiativeLifecycleAiAssistOperation): string {
  return OPERATION_INSTRUCTIONS[operation];
}

export function operationsForCapabilities(input: {
  readonly canGenerateDraft: boolean;
  readonly canRegenerateSection: boolean;
  readonly canImproveWording: boolean;
  readonly canIdentifyGaps: boolean;
  readonly canIdentifyContradictions: boolean;
  readonly canSummarize: boolean;
  readonly canExplain: boolean;
  readonly canAnswerQuestions: boolean;
}): InitiativeLifecycleAiAssistOperation[] {
  const ops: InitiativeLifecycleAiAssistOperation[] = [];

  if (input.canGenerateDraft) {
    ops.push("generate_draft");
  }
  if (input.canRegenerateSection) {
    ops.push("regenerate_section");
  }
  if (input.canImproveWording) {
    ops.push("improve_wording");
  }
  if (input.canIdentifyGaps) {
    ops.push("identify_missing_information");
  }
  if (input.canIdentifyContradictions) {
    ops.push("identify_contradictions");
  }
  if (input.canSummarize) {
    ops.push("summarize_source_themes");
  }
  if (input.canExplain) {
    ops.push("explain");
  }
  if (input.canAnswerQuestions) {
    ops.push("answer_question");
  }

  return ops;
}

export function operationLabel(operation: InitiativeLifecycleAiAssistOperation): string {
  switch (operation) {
    case "generate_draft":
      return "Generate";
    case "regenerate_section":
      return "Regenerate section";
    case "improve_wording":
      return "Improve";
    case "identify_missing_information":
      return "Identify gaps";
    case "identify_contradictions":
      return "Identify contradictions";
    case "summarize_source_themes":
      return "Summarize";
    case "explain":
      return "Explain";
    case "answer_question":
      return "Answer question";
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}
