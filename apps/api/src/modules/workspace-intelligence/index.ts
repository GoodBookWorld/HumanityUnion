/** @deprecated Legacy initiative analytics — not the canonical Workspace projection (see modules/workspace). */
export { default as workspaceIntelligenceRouter } from "./workspace-intelligence.routes.js";
export {
  getWorkspaceIntelligence,
  sanitizeWorkspaceIntelligenceResponse,
} from "./workspace-intelligence.service.js";
export { buildWorkspaceIntelligenceContext } from "./workspace-intelligence.context.js";
export {
  WORKSPACE_INTELLIGENCE_RULES,
  WORKSPACE_INTELLIGENCE_BLOCKED_RULES,
} from "./workspace-intelligence.registry.js";
export type {
  WorkspaceIntelligenceContext,
  WorkspaceIntelligenceResponse,
  WorkspaceSuggestion,
  WorkspaceBlockedAction,
} from "./workspace-intelligence.types.js";
