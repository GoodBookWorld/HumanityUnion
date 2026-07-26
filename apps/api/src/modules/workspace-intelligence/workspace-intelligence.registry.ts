import {
  evaluateBlockedActions,
  evaluatePipelineSuggestions,
  evaluateSectionSuggestions,
} from "./workspace-intelligence.rules.js";
import type {
  WorkspaceIntelligenceBlockedRuleDefinition,
  WorkspaceIntelligenceRuleDefinition,
} from "./workspace-intelligence.types.js";

export const WORKSPACE_INTELLIGENCE_RULES: readonly WorkspaceIntelligenceRuleDefinition[] = [
  {
    id: "pipeline-recommendations",
    description: "Deterministic civic pipeline next-step recommendations.",
    stage: "workspace",
    priority: "critical",
    evaluate: evaluatePipelineSuggestions,
  },
  {
    id: "section-recommendations",
    description: "Section-aware workspace navigation recommendations.",
    stage: "workspace",
    priority: "normal",
    evaluate: evaluateSectionSuggestions,
  },
] as const;

export const WORKSPACE_INTELLIGENCE_BLOCKED_RULES: readonly WorkspaceIntelligenceBlockedRuleDefinition[] =
  [
    {
      id: "blocked-action-detection",
      description: "Explain why civic actions cannot proceed yet.",
      evaluate: evaluateBlockedActions,
    },
  ] as const;
