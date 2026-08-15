import { isStandaloneDisplayMode } from "./presentation-mode";

export type PwaInstallUxState =
  | "already_installed"
  | "install_available"
  | "ios_add_to_home"
  | "unsupported"
  | "browser_mode";

export interface BeforeInstallPromptLike extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptLike | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptLike | null {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptLike | null): void {
  deferredPrompt = event;
  notifyListeners();
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/**
 * Canonical install UX resolver — never advertise an action that cannot run.
 */
export function resolvePwaInstallUxState(input?: {
  standalone?: boolean;
  deferredPrompt?: BeforeInstallPromptLike | null;
}): PwaInstallUxState {
  const standalone = input?.standalone ?? isStandaloneDisplayMode();

  if (standalone) {
    return "already_installed";
  }

  const prompt = input?.deferredPrompt !== undefined ? input.deferredPrompt : deferredPrompt;

  if (prompt) {
    return "install_available";
  }

  if (isIosLikeDevice()) {
    return "ios_add_to_home";
  }

  if (typeof window === "undefined") {
    return "browser_mode";
  }

  return "unsupported";
}
