import { BLOG_AUTHORING_MODULES } from "./modules/blog-authoring.js";
import { IDENTITY_WORKSPACE_MODULES } from "./modules/identity-workspace.js";
import { INITIATIVES_COLLABORATION_MODULES } from "./modules/initiatives-collaboration.js";
import { LIFECYCLE_PARTICIPATION_MODULES } from "./modules/lifecycle-participation.js";
import { NOTIFICATIONS_PRIVACY_SAFETY_MODULES } from "./modules/notifications-privacy-safety.js";
import type { PlatformKnowledgeModule } from "./types.js";

/** Canonical ordered catalog — single maintainable boundary. */
export const PLATFORM_KNOWLEDGE_MODULES: readonly PlatformKnowledgeModule[] = [
  ...IDENTITY_WORKSPACE_MODULES,
  ...INITIATIVES_COLLABORATION_MODULES,
  ...NOTIFICATIONS_PRIVACY_SAFETY_MODULES,
  ...LIFECYCLE_PARTICIPATION_MODULES,
  ...BLOG_AUTHORING_MODULES,
];

const MODULE_BY_ID = new Map(
  PLATFORM_KNOWLEDGE_MODULES.map((module) => [module.moduleId, module] as const),
);

export function getPlatformKnowledgeModule(
  moduleId: string,
): PlatformKnowledgeModule | undefined {
  return MODULE_BY_ID.get(moduleId);
}

/** Topic labels for session UI (labels only — full text stays server-side). */
export const PLATFORM_KNOWLEDGE_TOPIC_LABELS: readonly string[] = Array.from(
  new Set(PLATFORM_KNOWLEDGE_MODULES.map((module) => module.topicLabel)),
);

/**
 * Legacy flat topic view for callers that still expect Pack 02 shape.
 * Prefer retrievePlatformKnowledge for prompt injection.
 */
export const PLATFORM_KNOWLEDGE_TOPICS = PLATFORM_KNOWLEDGE_MODULES.map((module) => ({
  topicId: module.moduleId,
  label: module.topicLabel,
  summary: module.content.replace(/\s+/g, " ").slice(0, 280),
}));

/** Full corpus flatten — diagnostics / migration only; not for every Gemini call. */
export const PLATFORM_AI_KNOWLEDGE_PROMPT = PLATFORM_KNOWLEDGE_MODULES.map(
  (module) => `${module.label}: ${module.content}`,
).join("\n\n");
