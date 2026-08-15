/**
 * Humanity Union Assistant — canonical product UI (Pack 02–04 + Hardening 01).
 *
 * One modal, one provider path, one Core Policy.
 * Workspace Widget and floating FAB are launch surfaces only.
 * Session history: transient_browser_session (sessionStorage only).
 */

export { HumanityUnionAssistantShell } from "./components/HumanityUnionAssistantShell";
export { HumanityUnionAssistantModal } from "./components/HumanityUnionAssistantModal";
export { HumanityUnionAssistantOpenButton } from "./components/HumanityUnionAssistantOpenButton";
export { HumanityUnionAssistantWidget } from "./components/HumanityUnionAssistantWidget";
export { HumanityUnionAssistantFloatingButton } from "./components/HumanityUnionAssistantFloatingButton";
export { SurfaceAssistantEntry } from "./components/SurfaceAssistantEntry";
export { ProfileAssistantEntry } from "./components/ProfileAssistantEntry";
export {
  HumanityUnionAssistantProvider,
  useHumanityUnionAssistant,
  useOptionalHumanityUnionAssistant,
} from "./assistant-context";
export type { OpenHumanityUnionAssistantInput } from "./assistant-context";
export {
  resolveAssistantLaunchContext,
  assistantWidgetCopy,
} from "./resolve-assistant-surface";
export {
  loadAssistantBrowserSession,
  startNewAssistantConversation,
  clearAssistantConversationTurns,
  toAssistConversationHistory,
  ASSISTANT_CLIENT_MAX_HISTORY_TURNS,
} from "./assistant-session-memory";
