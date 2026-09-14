import type {
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleStageId,
} from "@hu/types";

export interface ResolvedAssistantLaunchContext {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
}

const HASH_TO_STAGE: Record<string, InitiativeLifecycleStageId> = {
  initiative: "initiative",
  discussion: "discussion",
  "collaborative-analysis": "analysis",
  analysis: "analysis",
  "improvement-proposals": "proposal",
  proposal: "proposal",
  revision: "revision",
  petition: "petition",
  "decision-session": "decision_session",
  decision_session: "decision_session",
  "collective-decision": "collective_decision",
  collective_decision: "collective_decision",
  "implementation-commitments": "commitment",
  commitment: "commitment",
  "implementation-tracking": "tracking",
  tracking: "tracking",
  "official-responses": "official_response",
  official_response: "official_response",
  "public-impact": "public_impact",
  public_impact: "public_impact",
  "civic-archive": "archive",
  archive: "archive",
};

const STAGE_TO_SURFACE: Record<InitiativeLifecycleStageId, HumanityUnionAssistantSurfaceId> = {
  initiative: "initiative",
  discussion: "discussion",
  analysis: "analysis",
  proposal: "proposal",
  revision: "revision",
  petition: "petition",
  decision_session: "decision_session",
  collective_decision: "collective_decision",
  commitment: "commitment",
  tracking: "tracking",
  official_response: "official_response",
  public_impact: "public_impact",
  archive: "archive",
};

function extractInitiativeId(pathname: string): string | undefined {
  const patterns = [
    /\/initiatives\/(?:public\/)?(initiative-[^/]+)/i,
    /[?&]initiativeId=(initiative-[^&]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Maps standalone Lifecycle public/app routes (without /initiatives/… prefix)
 * onto the matching Assistant surface. Initiative id may be absent — surface
 * still specializes correctly; FAB/OpenButton can supply id when available.
 */
function resolveStandaloneStageRoute(
  path: string,
): ResolvedAssistantLaunchContext | null {
  const rules: Array<{
    readonly match: RegExp;
    readonly stageId: InitiativeLifecycleStageId;
  }> = [
    { match: /\/(?:collaborative-analysis|initiative-analyses)\b/i, stageId: "analysis" },
    { match: /\/improvement-proposals?\b/i, stageId: "proposal" },
    { match: /\/(?:initiative-)?revisions?\b/i, stageId: "revision" },
    { match: /\/petitions?\b/i, stageId: "petition" },
    { match: /\/decision-sessions?\b/i, stageId: "decision_session" },
    { match: /\/collective-decisions?\b/i, stageId: "collective_decision" },
    {
      match: /\/(?:implementation-commitments?|implementations?)\b/i,
      stageId: "commitment",
    },
    { match: /\/implementation-tracking\b/i, stageId: "tracking" },
    { match: /\/(?:official-responses?|public-responses?)\b/i, stageId: "official_response" },
    { match: /\/public-impact\b/i, stageId: "public_impact" },
    { match: /\/(?:civic-archive|public-civic-archive)\b/i, stageId: "archive" },
  ];

  for (const rule of rules) {
    if (rule.match.test(path)) {
      return {
        surfaceId: STAGE_TO_SURFACE[rule.stageId],
        stageId: rule.stageId,
      };
    }
  }

  return null;
}

/**
 * Maps the current browser location to Assistant surface context.
 * Private message history is never inferred here — only communication-feature surface.
 */
export function resolveAssistantLaunchContext(
  pathname: string,
  hash = "",
): ResolvedAssistantLaunchContext {
  const path = pathname.replace(/\/+$/, "") || "/";
  const normalizedHash = hash.replace(/^#/, "").trim().toLowerCase();

  if (path === "/workspace" || path === "/workspace/home") {
    return { surfaceId: "workspace" };
  }

  if (path.startsWith("/workspace/initiatives")) {
    return { surfaceId: "initiatives" };
  }

  if (path.startsWith("/workspace/messages")) {
    return { surfaceId: "messages" };
  }

  if (path.startsWith("/notifications")) {
    return { surfaceId: "notifications" };
  }

  if (path.startsWith("/preferences")) {
    return { surfaceId: "preferences" };
  }

  if (path === "/profile" || path.startsWith("/member/") || path.startsWith("/participation/")) {
    return { surfaceId: "profile" };
  }

  const initiativeId = extractInitiativeId(path);
  if (initiativeId) {
    const stageFromHash = HASH_TO_STAGE[normalizedHash];
    if (stageFromHash) {
      return {
        surfaceId: STAGE_TO_SURFACE[stageFromHash],
        initiativeId,
        stageId: stageFromHash,
      };
    }

    if (normalizedHash === "discussion" || path.includes("/discussion")) {
      return { surfaceId: "discussion", initiativeId, stageId: "initiative" };
    }

    return { surfaceId: "initiative", initiativeId, stageId: "initiative" };
  }

  const standalone = resolveStandaloneStageRoute(path);
  if (standalone) {
    return standalone;
  }

  if (path.startsWith("/initiatives") || path === "/") {
    return { surfaceId: "initiatives" };
  }

  if (path.includes("archive") || path.startsWith("/knowledge")) {
    return { surfaceId: "archive" };
  }

  if (
    path.startsWith("/blog") ||
    path.startsWith("/workspace/authoring") ||
    path.startsWith("/workspace/publishing") ||
    path.startsWith("/workspace/editorial")
  ) {
    return { surfaceId: "blog" };
  }

  // Guest / public fallback — platform orientation, never private context.
  return { surfaceId: "initiatives" };
}

/** Catalog key under `initiativeExperience` for Workspace widget blurbs. */
export function assistantWidgetCopyKey(
  surfaceId: HumanityUnionAssistantSurfaceId,
): string {
  switch (surfaceId) {
    case "workspace":
      return "assistant.entry.widgetCopy.workspace";
    case "initiatives":
      return "assistant.entry.widgetCopy.initiatives";
    case "commitment":
      return "assistant.entry.widgetCopy.commitment";
    case "notifications":
      return "assistant.entry.widgetCopy.notifications";
    case "messages":
      return "assistant.entry.widgetCopy.messages";
    case "preferences":
      return "assistant.entry.widgetCopy.preferences";
    case "profile":
      return "assistant.entry.widgetCopy.profile";
    case "blog":
      return "assistant.entry.widgetCopy.blog";
    default:
      return "assistant.entry.widgetCopy.default";
  }
}

/**
 * English fallback blurbs for non-UI callers / legacy unit tests.
 * Mounted UI resolves `assistantWidgetCopyKey` via next-intl.
 */
export function assistantWidgetCopy(
  surfaceId: HumanityUnionAssistantSurfaceId,
): string {
  switch (surfaceId) {
    case "workspace":
      return "I can help you understand your Workspace, priorities, notifications and next civic actions.";
    case "initiatives":
      return "I can help you create, review and advance your Initiatives.";
    case "commitment":
      return "I can help with responsibilities, resources and Implementation Commitments.";
    case "notifications":
      return "Ask Humanity Union Assistant about Notifications";
    case "messages":
      return "I can explain communication features and privacy — without reading private message history.";
    case "preferences":
      return "I can help you understand Preferences, notifications and privacy choices.";
    case "profile":
      return "I can explain Profile and Participation Area choices.";
    case "blog":
      return "I can explain the Blog publishing workflow, authorship, and categories — I never publish for you.";
    default:
      return "I can help with this context or answer questions about Humanity Union.";
  }
}
