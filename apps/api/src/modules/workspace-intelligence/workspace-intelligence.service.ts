import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { isInitiativeOwnedBy } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { buildWorkspaceIntelligenceContext } from "./workspace-intelligence.context.js";
import {
  WORKSPACE_INTELLIGENCE_BLOCKED_RULES,
  WORKSPACE_INTELLIGENCE_RULES,
} from "./workspace-intelligence.registry.js";
import type {
  WorkspaceIntelligenceResponse,
  WorkspaceSuggestion,
  WorkspaceSuggestionPriority,
} from "./workspace-intelligence.types.js";
import { WORKSPACE_SUGGESTION_PRIORITY_ORDER } from "./workspace-intelligence.types.js";

const PRIVATE_RESPONSE_KEYS = [
  "participantId",
  "userId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "memberId",
  "stewardId",
  "authorId",
  "voteId",
  "transparencyCohort",
  "jwt",
] as const;

function sortSuggestions(suggestions: WorkspaceSuggestion[]): WorkspaceSuggestion[] {
  return [...suggestions].sort((left, right) => {
    const leftIndex = WORKSPACE_SUGGESTION_PRIORITY_ORDER.indexOf(left.priority);
    const rightIndex = WORKSPACE_SUGGESTION_PRIORITY_ORDER.indexOf(right.priority);
    return leftIndex - rightIndex;
  });
}

function dedupeSuggestions(suggestions: WorkspaceSuggestion[]): WorkspaceSuggestion[] {
  const seen = new Set<string>();
  const unique: WorkspaceSuggestion[] = [];

  for (const item of suggestions) {
    if (seen.has(item.suggestionId)) {
      continue;
    }

    seen.add(item.suggestionId);
    unique.push(item);
  }

  return unique;
}

function buildConstitutionalSummary(input: {
  topRecommendation: WorkspaceSuggestion | null;
  nextMilestone: string | null;
  responsibilities: string[];
}): string {
  if (input.topRecommendation) {
    return input.topRecommendation.constitutionalReference;
  }

  if (input.responsibilities.length > 0) {
    return `Current responsibilities: ${input.responsibilities.join("; ")}.`;
  }

  if (input.nextMilestone) {
    return `Next civic milestone: ${input.nextMilestone.replace(/_/g, " ")}.`;
  }

  return "No immediate civic action is recommended based on current records.";
}

export function sanitizeWorkspaceIntelligenceResponse(
  response: WorkspaceIntelligenceResponse,
): WorkspaceIntelligenceResponse {
  const serialized = JSON.stringify(response);
  const lower = serialized.toLowerCase();

  for (const key of PRIVATE_RESPONSE_KEYS) {
    if (lower.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`Workspace intelligence response must not expose ${key}.`);
    }
  }

  return response;
}

export async function getWorkspaceIntelligence(input: {
  identity: RequestIdentity;
  userId: string;
  displayName: string;
  initiativeId?: string;
  currentSection?: string;
}): Promise<WorkspaceIntelligenceResponse> {
  if (input.initiativeId) {
    const initiative = getInitiativeById(input.initiativeId);

    if (!initiative) {
      throw new Error("Initiative not found.");
    }

    const isSteward = isInitiativeOwnedBy(initiative, input.identity);
    const isPublishedWorkspaceView = initiative.lifecyclePhase !== "draft";

    if (!isSteward && !isPublishedWorkspaceView) {
      throw new Error("You do not have access to this initiative.");
    }
  }

  const context = await buildWorkspaceIntelligenceContext(input);
  const ruleInput = { context };

  const suggestions = dedupeSuggestions(
    sortSuggestions(WORKSPACE_INTELLIGENCE_RULES.flatMap((rule) => rule.evaluate(ruleInput))),
  );

  const blockedActions = WORKSPACE_INTELLIGENCE_BLOCKED_RULES.flatMap((rule) =>
    rule.evaluate(ruleInput),
  );

  const topRecommendation = suggestions[0] ?? null;

  const response: WorkspaceIntelligenceResponse = {
    context,
    currentCivicStage: context.currentCivicStage,
    currentResponsibilities: context.openResponsibilities,
    suggestions,
    blockedActions,
    nextCivicMilestone: context.nextCivicMilestone,
    topRecommendation,
    constitutionalSummary: buildConstitutionalSummary({
      topRecommendation,
      nextMilestone: context.nextCivicMilestone,
      responsibilities: context.openResponsibilities,
    }),
  };

  return sanitizeWorkspaceIntelligenceResponse(response);
}

export function priorityWeight(priority: WorkspaceSuggestionPriority): number {
  return WORKSPACE_SUGGESTION_PRIORITY_ORDER.indexOf(priority);
}
