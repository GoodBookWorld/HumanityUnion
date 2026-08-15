"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type {
  HumanityUnionAssistantAssistResult,
  HumanityUnionAssistantSessionContext,
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getLifecycleAiAnalysisDraftExcerpt } from "../../lifecycle-ai-assistant/lifecycle-ai-draft-excerpt-bridge";
import { dispatchLifecycleAiApplySuggestions } from "../../lifecycle-ai-assistant/lifecycle-ai-suggestion-events";
import {
  getHumanityUnionAssistantSessionContext,
  requestHumanityUnionAssistantAssist,
} from "../api";
import {
  clearAssistantConversationTurns,
  loadAssistantBrowserSession,
  saveAssistantBrowserSession,
  startNewAssistantConversation,
  toAssistConversationHistory,
  type AssistantSessionTurn,
} from "../assistant-session-memory";

import "../humanity-union-assistant.css";

export interface HumanityUnionAssistantModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
}

/**
 * Guest behavior (Pack 04): Assistant API requires authenticated identity.
 * Guests see sign-in / register guidance — never authenticated personal context.
 *
 * Production Hardening Pack 01: browser-session memory (sessionStorage),
 * New Conversation / Clear Context, development diagnostics panel.
 */
export function HumanityUnionAssistantModal({
  isOpen,
  onClose,
  surfaceId,
  initiativeId,
  stageId,
  pagePath,
}: HumanityUnionAssistantModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<HumanityUnionAssistantSessionContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [result, setResult] = useState<HumanityUnionAssistantAssistResult | null>(null);
  const [turns, setTurns] = useState<AssistantSessionTurn[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const greetedForSessionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      setContext(null);
      setQuestion("");
      setResult(null);
      setAssistError(null);
      setApplyNotice(null);
      setNeedsSignIn(false);
      setLoadError(null);
      setDiagnosticsOpen(false);
      return;
    }

    const stored = loadAssistantBrowserSession();
    setSessionId(stored.sessionId);
    setTurns([...stored.turns]);

    let cancelled = false;
    setLoadError(null);
    setNeedsSignIn(false);

    getHumanityUnionAssistantSessionContext({
      surfaceId,
      initiativeId,
      stageId,
      pagePath,
    })
      .then((session) => {
        if (cancelled) {
          return;
        }
        setContext(session);

        const nextState = {
          sessionId: stored.sessionId,
          turns: stored.turns,
          surfaceId,
          initiativeId,
          stageId,
        };
        saveAssistantBrowserSession(nextState);

        const shouldGreet =
          stored.turns.length === 0 && greetedForSessionRef.current !== stored.sessionId;
        if (shouldGreet) {
          greetedForSessionRef.current = stored.sessionId;
          const greetingTurn: AssistantSessionTurn = {
            id: "greeting",
            role: "assistant",
            text: session.greeting,
            meta: session.specializationSummary,
          };
          setTurns([greetingTurn]);
          saveAssistantBrowserSession({
            ...nextState,
            turns: [greetingTurn],
          });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(error)) {
          setNeedsSignIn(true);
          setLoadError(null);
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : "Could not open Humanity Union Assistant.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, isOpen, pagePath, stageId, surfaceId]);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      return;
    }
    saveAssistantBrowserSession({
      sessionId,
      turns,
      surfaceId,
      initiativeId,
      stageId,
    });
  }, [initiativeId, isOpen, sessionId, stageId, surfaceId, turns]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!conversationRef.current) {
      return;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    conversationRef.current.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [turns, busy]);

  if (!isOpen) {
    return null;
  }

  function handleNewConversation() {
    abortRef.current?.abort();
    const next = startNewAssistantConversation({ surfaceId, initiativeId, stageId });
    setSessionId(next.sessionId);
    setTurns([]);
    setResult(null);
    setAssistError(null);
    setApplyNotice(null);
    greetedForSessionRef.current = null;
    if (context) {
      const greetingTurn: AssistantSessionTurn = {
        id: "greeting",
        role: "assistant",
        text: context.greeting,
        meta: context.specializationSummary,
      };
      greetedForSessionRef.current = next.sessionId;
      setTurns([greetingTurn]);
      saveAssistantBrowserSession({
        ...next,
        turns: [greetingTurn],
      });
    }
  }

  function handleClearContext() {
    abortRef.current?.abort();
    const cleared = clearAssistantConversationTurns({
      sessionId: sessionId || "local",
      turns,
      surfaceId,
      initiativeId,
      stageId,
    });
    setTurns([]);
    setResult(null);
    setAssistError(null);
    setApplyNotice(null);
    if (context) {
      const greetingTurn: AssistantSessionTurn = {
        id: "greeting",
        role: "assistant",
        text: context.greeting,
        meta: context.specializationSummary,
      };
      setTurns([greetingTurn]);
      saveAssistantBrowserSession({
        ...cleared,
        turns: [greetingTurn],
      });
    }
  }

  async function runAssist(
    operation: InitiativeLifecycleAiAssistOperation,
    instructions?: string,
  ) {
    setBusy(true);
    setAssistError(null);
    setApplyNotice(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const asked = instructions?.trim();
    let nextTurns = turns;
    if (asked) {
      const participantTurn: AssistantSessionTurn = {
        id: `q-${Date.now()}`,
        role: "participant",
        text: asked,
      };
      nextTurns = [...turns, participantTurn];
      setTurns(nextTurns);
    }

    try {
      const assistResult = await requestHumanityUnionAssistantAssist({
        surfaceId,
        initiativeId,
        stageId: stageId ?? context?.stageId ?? undefined,
        operation,
        instructions: asked || undefined,
        conversationHistory: toAssistConversationHistory(nextTurns),
        currentDraftExcerpt:
          operation === "improve_wording" || operation === "regenerate_section"
            ? getLifecycleAiAnalysisDraftExcerpt() || undefined
            : undefined,
      });

      if (assistResult.autoApplied || assistResult.autoPublished) {
        throw new Error("AI attempted an automatic edit or publication, which is forbidden.");
      }

      setResult(assistResult);
      const replyText = assistResult.suggestions.map((item) => item.suggestedText).join("\n\n");
      setTurns((previous) => [
        ...previous,
        {
          id: assistResult.requestId,
          role: "assistant",
          text: replyText,
        },
      ]);
      setQuestion("");
    } catch (error) {
      setResult(null);
      if (isAuthenticationRequiredError(error)) {
        setNeedsSignIn(true);
        setAssistError(null);
        return;
      }
      const raw = error instanceof Error ? error.message : "";
      if (/could not be processed safely/i.test(raw)) {
        setAssistError(raw);
      } else if (/too many|rate/i.test(raw)) {
        setAssistError("Too many Assistant requests. Please wait a moment and try again.");
      } else if (
        /temporarily unavailable|not configured|Author Workspace|not found|could not be completed/i.test(
          raw,
        )
      ) {
        setAssistError(raw);
      } else {
        setAssistError("The Assistant is temporarily unavailable. Please try again shortly.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleUseSuggestions() {
    if (!result || !context?.canApplySuggestionsToDraft || !initiativeId || !context.stageId) {
      return;
    }

    dispatchLifecycleAiApplySuggestions({
      initiativeId,
      stageId: context.stageId,
      suggestions: result.suggestions,
    });
    setApplyNotice(
      "Suggestion copied into your draft editor locally. Edit it, then Save → Preview → Publish. Nothing was published automatically.",
    );
  }

  const contextLabel = context?.currentFeatureLabel ?? "Loading context…";
  const showDevDiagnostics =
    process.env.NODE_ENV === "development" &&
    Boolean(result?.diagnostics || context?.diagnostics);
  const activeDiagnostics = result?.diagnostics ?? context?.diagnostics;

  return (
    <div className="hu-assistant-modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="hu-assistant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="hu-assistant-modal__header">
          <div className="hu-assistant-modal__brand">
            <img
              src="/icons/workspace/intel.webp"
              alt=""
              width={36}
              height={36}
              className="hu-assistant-modal__brand-icon"
              decoding="async"
            />
            <div>
              <h2 id={titleId} className="hu-assistant-modal__title hu-widget-title">
                Humanity Union Assistant
              </h2>
              <p id={descriptionId} className="hu-assistant-modal__context-label">
                {contextLabel}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="hu-assistant-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="hu-assistant-modal__body">
          {needsSignIn ? (
            <div className="hu-assistant-modal__guest">
              <p>
                Sign in to use the Humanity Union Assistant with your Workspace and Initiative
                context.
              </p>
              <div className="hu-assistant-modal__actions">
                <Link href="/login" className="hu-assistant-modal__link-button">
                  Sign in
                </Link>
                <Link href="/register" className="hu-assistant-modal__link-button secondary">
                  Register
                </Link>
              </div>
            </div>
          ) : null}

          {loadError ? <p className="hu-assistant-modal__error">{loadError}</p> : null}

          {context && !needsSignIn ? (
            <>
              <div className="hu-assistant-modal__session-bar" role="toolbar" aria-label="Conversation">
                <button type="button" className="secondary" disabled={busy} onClick={handleNewConversation}>
                  New Conversation
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={handleClearContext}>
                  Clear Current Context
                </button>
                <span className="hu-assistant-modal__session-note">Continue Conversation is the default.</span>
              </div>

              <p className="hu-assistant-modal__meta">
                Sources: {context.availableSourceLabels.join(" · ") || "Platform knowledge"}
                {context.initiativeTitle ? ` · ${context.initiativeTitle}` : ""}
                {context.stageLabel ? ` · ${context.stageLabel}` : ""}
              </p>

              <div
                ref={conversationRef}
                className="hu-assistant-modal__conversation"
                aria-live="polite"
              >
                {turns.map((turn) => (
                  <article key={turn.id} className="hu-assistant-modal__bubble">
                    <h3>{turn.role === "assistant" ? "Assistant" : "You"}</h3>
                    <p>{turn.text}</p>
                  </article>
                ))}
                {busy ? (
                  <p className="hu-assistant-modal__notice" role="status">
                    Working…
                  </p>
                ) : null}
              </div>

              {context.suggestedQuestions.length > 0 ? (
                <>
                  <p className="hu-assistant-modal__notice">Suggested questions</p>
                  <ul className="hu-assistant-modal__suggestions-list">
                    {context.suggestedQuestions.slice(0, 4).map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setQuestion(suggestion);
                            void runAssist("answer_question", suggestion);
                          }}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <p className="hu-assistant-modal__notice">
                Conversation memory is temporary for this browser session only. Private messages are
                never read automatically. AI never publishes.
              </p>

              {showDevDiagnostics && activeDiagnostics ? (
                <details
                  className="hu-assistant-modal__diagnostics"
                  open={diagnosticsOpen}
                  onToggle={(event) =>
                    setDiagnosticsOpen((event.currentTarget as HTMLDetailsElement).open)
                  }
                >
                  <summary>Development diagnostics</summary>
                  <ul>
                    <li>Active provider: {activeDiagnostics.activeProviderId}</li>
                    <li>Configured provider: {activeDiagnostics.configuredProvider}</li>
                    <li>Surface: {activeDiagnostics.surfaceId ?? surfaceId}</li>
                    <li>Stage: {context.stageId ?? "n/a"}</li>
                    <li>Presentation mode: {activeDiagnostics.presentationMode ?? context.presentationMode ?? "n/a"}</li>
                    <li>
                      Knowledge modules:{" "}
                      {(activeDiagnostics.retrievedKnowledgeModuleIds ?? []).join(", ") || "none"}
                    </li>
                    <li>
                      Prompt versions: {(activeDiagnostics.promptVersions ?? []).join(", ") || "n/a"}
                    </li>
                    <li>
                      Estimated prompt size: {activeDiagnostics.estimatedPromptChars ?? "n/a"} chars / ≈
                      {activeDiagnostics.estimatedPromptTokens ?? "n/a"} tokens
                    </li>
                    <li>Retry count: {activeDiagnostics.retryCount ?? 0}</li>
                    <li>Response time: {activeDiagnostics.responseDurationMs ?? "n/a"} ms</li>
                    <li>
                      History turns sent: {activeDiagnostics.conversationHistoryTurns ?? 0}
                    </li>
                  </ul>
                  <p className="hu-assistant-modal__notice">
                    Diagnostics never include prompts or API keys.
                  </p>
                </details>
              ) : null}
            </>
          ) : !loadError && !needsSignIn ? (
            <p className="hu-assistant-modal__notice" role="status">
              Loading Assistant…
            </p>
          ) : null}

          {assistError ? (
            <p className="hu-assistant-modal__error" role="alert">
              {assistError}
            </p>
          ) : null}
          {applyNotice ? <p className="hu-assistant-modal__notice">{applyNotice}</p> : null}

          {result && context?.canApplySuggestionsToDraft ? (
            <div className="hu-assistant-modal__actions">
              <button type="button" className="secondary" onClick={handleUseSuggestions}>
                Use suggestion in draft editor
              </button>
            </div>
          ) : null}
        </div>

        {context && !needsSignIn ? (
          <div className="hu-assistant-modal__footer">
            <div className="hu-assistant-modal__composer">
              <div className="hu-assistant-modal__input">
                <label>
                  <span>Ask the Assistant</span>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask about this context or Humanity Union…"
                    disabled={busy}
                  />
                </label>
              </div>

              <div className="hu-assistant-modal__actions">
                <button
                  type="button"
                  disabled={busy || !question.trim()}
                  onClick={() => void runAssist("answer_question", question)}
                >
                  {busy ? "Working…" : "Send"}
                </button>
                {context.allowedOperations.includes("explain") ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void runAssist("explain")}
                  >
                    Explain this context
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
