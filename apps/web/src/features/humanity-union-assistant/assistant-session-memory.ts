/**
 * Production Hardening Pack 01 — temporary browser-session conversation memory.
 * Uses sessionStorage only. Never MongoDB. Never Direct Messages.
 */

export interface AssistantSessionTurn {
  readonly id: string;
  readonly role: "assistant" | "participant";
  readonly text: string;
  readonly meta?: string;
}

export interface AssistantBrowserSessionState {
  readonly sessionId: string;
  readonly turns: readonly AssistantSessionTurn[];
  readonly surfaceId?: string;
  readonly initiativeId?: string;
  readonly stageId?: string;
}

const STORAGE_KEY = "hu.assistant.browserSession.v1";
export const ASSISTANT_CLIENT_MAX_HISTORY_TURNS = 12;

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `assistant-${Date.now()}`;
}

export function loadAssistantBrowserSession(): AssistantBrowserSessionState {
  if (!canUseSessionStorage()) {
    return { sessionId: createSessionId(), turns: [] };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sessionId: createSessionId(), turns: [] };
    }
    const parsed = JSON.parse(raw) as Partial<AssistantBrowserSessionState>;
    const turns = Array.isArray(parsed.turns)
      ? parsed.turns
          .filter(
            (turn): turn is AssistantSessionTurn =>
              Boolean(turn) &&
              (turn.role === "assistant" || turn.role === "participant") &&
              typeof turn.text === "string",
          )
          .slice(-ASSISTANT_CLIENT_MAX_HISTORY_TURNS)
      : [];
    return {
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : createSessionId(),
      turns,
      surfaceId: typeof parsed.surfaceId === "string" ? parsed.surfaceId : undefined,
      initiativeId: typeof parsed.initiativeId === "string" ? parsed.initiativeId : undefined,
      stageId: typeof parsed.stageId === "string" ? parsed.stageId : undefined,
    };
  } catch {
    return { sessionId: createSessionId(), turns: [] };
  }
}

export function saveAssistantBrowserSession(state: AssistantBrowserSessionState): void {
  if (!canUseSessionStorage()) {
    return;
  }

  const bounded: AssistantBrowserSessionState = {
    ...state,
    turns: state.turns.slice(-ASSISTANT_CLIENT_MAX_HISTORY_TURNS),
  };

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore quota / private-mode failures; conversation still works in-memory.
  }
}

export function startNewAssistantConversation(
  context?: Pick<AssistantBrowserSessionState, "surfaceId" | "initiativeId" | "stageId">,
): AssistantBrowserSessionState {
  const next: AssistantBrowserSessionState = {
    sessionId: createSessionId(),
    turns: [],
    surfaceId: context?.surfaceId,
    initiativeId: context?.initiativeId,
    stageId: context?.stageId,
  };
  saveAssistantBrowserSession(next);
  return next;
}

export function clearAssistantConversationTurns(
  state: AssistantBrowserSessionState,
): AssistantBrowserSessionState {
  const next: AssistantBrowserSessionState = {
    ...state,
    turns: [],
  };
  saveAssistantBrowserSession(next);
  return next;
}

export function toAssistConversationHistory(
  turns: readonly AssistantSessionTurn[],
): Array<{ role: "assistant" | "participant"; text: string }> {
  return turns
    .filter((turn) => turn.id !== "greeting")
    .slice(-ASSISTANT_CLIENT_MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, text: turn.text }));
}
