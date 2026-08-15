import { PLATFORM_KNOWLEDGE_MODULES, getPlatformKnowledgeModule } from "./catalog.js";
import type {
  PlatformKnowledgeModule,
  RetrievePlatformKnowledgeInput,
  RetrievedPlatformKnowledge,
} from "./types.js";
import {
  PLATFORM_KNOWLEDGE_RETRIEVAL_PREAMBLE,
  PLATFORM_KNOWLEDGE_VERSION,
} from "./version.js";

const DEFAULT_MAX_MODULES = 6;

const STAGE_MODULE_IDS: Record<string, string> = {
  initiative: "lifecycle_initiative",
  analysis: "lifecycle_analysis",
  proposal: "lifecycle_proposal",
  revision: "lifecycle_revision",
  petition: "lifecycle_petition",
  decision_session: "lifecycle_decision_session",
  collective_decision: "lifecycle_collective_decision",
  commitment: "commitments",
  tracking: "tracking",
  official_response: "lifecycle_official_response",
  public_impact: "lifecycle_public_impact",
  archive: "civic_archive",
};

const SURFACE_SEED_MODULES: Record<string, readonly string[]> = {
  workspace: ["workspace", "participant_member"],
  profile: ["profile", "privacy", "participant_member"],
  preferences: ["preferences", "privacy"],
  initiatives: ["initiatives", "lifecycle_overview"],
  initiative: ["initiatives", "lifecycle_overview"],
  discussion: ["discussion", "collaboration"],
  analysis: ["lifecycle_analysis", "lifecycle_overview"],
  proposal: ["lifecycle_proposal", "lifecycle_overview"],
  revision: ["lifecycle_revision", "lifecycle_overview"],
  petition: ["lifecycle_petition", "participation_representative"],
  decision_session: ["lifecycle_decision_session", "lifecycle_overview"],
  collective_decision: ["lifecycle_collective_decision", "participation_representative"],
  commitment: ["commitments", "tracking"],
  tracking: ["tracking", "commitments"],
  official_response: ["lifecycle_official_response"],
  public_impact: ["lifecycle_public_impact", "tracking"],
  archive: ["civic_archive", "lifecycle_overview"],
  notifications: ["notifications", "reminders"],
  messages: ["messages", "privacy"],
  blog: ["blog_publishing", "blog_author_access"],
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreModule(
  module: PlatformKnowledgeModule,
  query: string,
  surfaceId: string | undefined,
): number {
  let score = 0;

  if (surfaceId && module.surfaces !== "all" && module.surfaces.includes(surfaceId as never)) {
    score += 1;
  }

  for (const keyword of module.keywords) {
    const needle = keyword.toLowerCase();
    if (!needle) {
      continue;
    }
    if (query.includes(needle)) {
      // Longer phrases are more specific signals.
      score += Math.min(6, 2 + Math.floor(needle.length / 6));
    }
  }

  if (query.includes(module.label.toLowerCase()) || query.includes(module.topicLabel.toLowerCase())) {
    score += 2;
  }

  return score;
}

function addModule(
  selected: Map<string, PlatformKnowledgeModule>,
  moduleId: string,
  maxModules: number,
): void {
  if (selected.size >= maxModules || selected.has(moduleId)) {
    return;
  }
  const module = getPlatformKnowledgeModule(moduleId);
  if (module) {
    selected.set(moduleId, module);
  }
}

/**
 * Bounded contextual retrieval for platform questions.
 * Query matches take priority over surface seeds so unrelated categories stay out.
 */
export function retrievePlatformKnowledge(
  input: RetrievePlatformKnowledgeInput,
): RetrievedPlatformKnowledge {
  const maxModules = Math.max(2, Math.min(input.maxModules ?? DEFAULT_MAX_MODULES, 8));
  const instructionQuery = normalizeText(input.instructions);
  const query = normalizeText(
    [input.instructions, input.operation, input.surfaceId, input.stageId ?? ""]
      .filter(Boolean)
      .join(" "),
  );
  const surfaceId = input.surfaceId?.trim();
  const selected = new Map<string, PlatformKnowledgeModule>();
  const hasSpecificQuestion = instructionQuery.length >= 8;

  const scored = PLATFORM_KNOWLEDGE_MODULES.map((module) => ({
    module,
    score: scoreModule(module, query, surfaceId),
  })).sort((a, b) => b.score - a.score);

  // 1) Strong query matches first (and their related modules).
  for (const entry of scored) {
    if (entry.score < 3) {
      break;
    }
    addModule(selected, entry.module.moduleId, maxModules);
    for (const relatedId of entry.module.relatedModuleIds ?? []) {
      addModule(selected, relatedId, maxModules);
    }
  }

  // 2) Stage-bound knowledge when a Lifecycle stage is in session.
  if (input.stageId && STAGE_MODULE_IDS[input.stageId]) {
    addModule(selected, STAGE_MODULE_IDS[input.stageId]!, maxModules);
  }

  // 3) Surface seeds only when the question is weak/absent — avoid crowding out matches.
  if (!hasSpecificQuestion || selected.size < 2) {
    if (surfaceId && SURFACE_SEED_MODULES[surfaceId]) {
      for (const moduleId of SURFACE_SEED_MODULES[surfaceId]!) {
        addModule(selected, moduleId, maxModules);
      }
    }
  }

  // 4) Lifecycle overview for broad lifecycle questions without a specific stage module hit.
  if (/\blifecycle\b/i.test(instructionQuery) && !selected.has("lifecycle_overview")) {
    addModule(selected, "lifecycle_overview", maxModules);
  }

  // 5) Always keep Assistant capability boundaries available.
  addModule(selected, "assistant_capabilities", maxModules);
  if (selected.size === 0) {
    addModule(selected, "platform_identity", maxModules);
    addModule(selected, "assistant_capabilities", maxModules);
  }

  const modules = [...selected.values()];
  const promptBlock = [
    PLATFORM_KNOWLEDGE_RETRIEVAL_PREAMBLE,
    "",
    `platformKnowledgeVersion: ${PLATFORM_KNOWLEDGE_VERSION}`,
    "",
    ...modules.map((module) => `### ${module.label}\n${module.content}`),
  ].join("\n");

  return {
    platformKnowledgeVersion: PLATFORM_KNOWLEDGE_VERSION,
    modules,
    moduleIds: modules.map((module) => module.moduleId),
    promptBlock,
  };
}

/** Test helper: assert unrelated modules were not retrieved. */
export function retrievedModuleIdSet(
  knowledge: RetrievedPlatformKnowledge,
): ReadonlySet<string> {
  return new Set(knowledge.moduleIds);
}
