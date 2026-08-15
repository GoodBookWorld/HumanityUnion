"use client";

import type { CommunicationMode } from "../direct-messaging-format";

interface CommunicationModeSwitchProps {
  mode: CommunicationMode;
  onChange: (mode: CommunicationMode) => void;
}

/**
 * Communication UX Pack 03.9 Part 2 — the single entry point for choosing
 * between Personal Chat (one-to-one Direct Messaging, unchanged) and
 * Initiative Group Chat. Always visible at the top of Workspace Messages,
 * and always reflects/drives the page's URL (`?mode=`), never local-only
 * state, so a direct link or refresh lands on the right mode.
 */
export function CommunicationModeSwitch({ mode, onChange }: CommunicationModeSwitchProps) {
  return (
    <div className="communication-mode-switch" role="tablist" aria-label="Communication mode">
      <button
        type="button"
        role="tab"
        id="communication-mode-tab-personal"
        aria-selected={mode === "personal"}
        aria-controls="communication-mode-panel"
        className={`communication-mode-switch__tab${mode === "personal" ? " communication-mode-switch__tab--active" : ""}`}
        onClick={() => onChange("personal")}
      >
        Personal Chat
      </button>
      <button
        type="button"
        role="tab"
        id="communication-mode-tab-initiative"
        aria-selected={mode === "initiative"}
        aria-controls="communication-mode-panel"
        className={`communication-mode-switch__tab${mode === "initiative" ? " communication-mode-switch__tab--active" : ""}`}
        onClick={() => onChange("initiative")}
      >
        Initiative Group Chat
      </button>
    </div>
  );
}
