"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  HumanityUnionAssistantAssistResult,
  HumanityUnionAssistantSessionContext,
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getLifecycleAiDraftExcerpt } from "../../lifecycle-ai-assistant/lifecycle-ai-draft-excerpt-bridge";
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
  const t = useTranslations("initiativeExperience");
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
          error instanceof Error && error.message.trim()
            ? error.message
            : t("assistant.messages.openFailed"),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, isOpen, pagePath, stageId, surfaceId, t]);

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
          operation === "improve_wording" ||
          operation === "regenerate_section" ||
          operation === "generate_draft" ||
          operation === "identify_missing_information"
            ? getLifecycleAiDraftExcerpt(
                stageId ??
                  context?.stageId ??
                  (surfaceId === "blog" ? "blog_authoring" : "analysis"),
              ) || undefined
            : undefined,
        pagePath,
      });

      if (assistResult.autoApplied || assistResult.autoPublished) {
        throw new Error(t("assistant.messages.autoApplyForbidden"));
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
        setAssistError(t("assistant.messages.rateLimited"));
      } else if (
        /temporarily unavailable|not configured|Author Workspace|not found|could not be completed/i.test(
          raw,
        )
      ) {
        setAssistError(raw);
      } else {
        setAssistError(t("assistant.messages.temporarilyUnavailable"));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleUseSuggestions() {
    if (!result || !context?.canApplySuggestionsToDraft) {
      return;
    }

    if (surfaceId === "blog") {
      dispatchLifecycleAiApplySuggestions({
        initiativeId: "blog",
        stageId: "blog_authoring",
        suggestions: result.suggestions,
      });
      setApplyNotice(t("assistant.messages.appliedToBlog"));
      return;
    }

    if (!initiativeId || !context.stageId) {
      return;
    }

    dispatchLifecycleAiApplySuggestions({
      initiativeId,
      stageId: context.stageId,
      suggestions: result.suggestions,
    });
    setApplyNotice(
      t("assistant.messages.appliedToDraft", {
        saveDraft: t("author.actions.saveDraft"),
        preview: t("author.actions.preview"),
        publish: t("author.actions.publish"),
      }),
    );
  }

  const contextLabel = context?.currentFeatureLabel ?? t("assistant.modal.loadingContext");
  const showDevDiagnostics =
    process.env.NODE_ENV === "development" &&
    Boolean(result?.diagnostics || context?.diagnostics);
  const activeDiagnostics = result?.diagnostics ?? context?.diagnostics;
  const sourcesLabel =
    context?.availableSourceLabels.join(" · ") || t("assistant.modal.platformKnowledge");

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
                {t("assistant.modal.title")}
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
            aria-label={t("assistant.modal.closeAria")}
          >
            {t("assistant.modal.close")}
          </button>
        </div>

        <div className="hu-assistant-modal__body">
          {needsSignIn ? (
            <div className="hu-assistant-modal__guest">
              <p>{t("assistant.modal.guestGuidance")}</p>
              <div className="hu-assistant-modal__actions">
                <Link href="/login" className="hu-assistant-modal__link-button">
                  {t("assistant.modal.signIn")}
                </Link>
                <Link href="/register" className="hu-assistant-modal__link-button secondary">
                  {t("assistant.modal.register")}
                </Link>
              </div>
            </div>
          ) : null}

          {loadError ? <p className="hu-assistant-modal__error">{loadError}</p> : null}

          {context && !needsSignIn ? (
            <>
              <div
                className="hu-assistant-modal__session-bar"
                role="toolbar"
                aria-label={t("assistant.modal.conversationAria")}
              >
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={handleNewConversation}
                >
                  {t("assistant.modal.newConversation")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={handleClearContext}
                >
                  {t("assistant.modal.clearContext")}
                </button>
                <span className="hu-assistant-modal__session-note">
                  {t("assistant.modal.continueDefault")}
                </span>
              </div>

              <p className="hu-assistant-modal__meta">
                {t("assistant.modal.sourcesPrefix", { sources: sourcesLabel })}
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
                    <h3>
                      {turn.role === "assistant"
                        ? t("assistant.modal.roleAssistant")
                        : t("assistant.modal.roleYou")}
                    </h3>
                    <p>{turn.text}</p>
                  </article>
                ))}
                {busy ? (
                  <p className="hu-assistant-modal__notice" role="status">
                    {t("assistant.modal.working")}
                  </p>
                ) : null}
              </div>

              {context.suggestedQuestions.length > 0 ? (
                <>
                  <p className="hu-assistant-modal__notice">
                    {t("assistant.modal.suggestedQuestions")}
                  </p>
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

              <p className="hu-assistant-modal__notice">{t("assistant.modal.privacyNotice")}</p>

              {showDevDiagnostics && activeDiagnostics ? (
                <details
                  className="hu-assistant-modal__diagnostics"
                  open={diagnosticsOpen}
                  onToggle={(event) =>
                    setDiagnosticsOpen((event.currentTarget as HTMLDetailsElement).open)
                  }
                >
                  <summary>{t("assistant.modal.diagnosticsSummary")}</summary>
                  <ul>
                    <li>
                      {t("assistant.modal.diagnosticsProvider", {
                        value: activeDiagnostics.activeProviderId,
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsConfigured", {
                        value: activeDiagnostics.configuredProvider,
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsSurface", {
                        value: activeDiagnostics.surfaceId ?? surfaceId,
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsStage", {
                        value: context.stageId ?? t("assistant.modal.diagnosticsNa"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsPresentation", {
                        value:
                          activeDiagnostics.presentationMode ??
                          context.presentationMode ??
                          t("assistant.modal.diagnosticsNa"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsKnowledge", {
                        value:
                          (activeDiagnostics.retrievedKnowledgeModuleIds ?? []).join(", ") ||
                          t("assistant.modal.diagnosticsNone"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsPrompts", {
                        value:
                          (activeDiagnostics.promptVersions ?? []).join(", ") ||
                          t("assistant.modal.diagnosticsNa"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsPromptSize", {
                        chars: activeDiagnostics.estimatedPromptChars ?? t("assistant.modal.diagnosticsNa"),
                        tokens:
                          activeDiagnostics.estimatedPromptTokens ?? t("assistant.modal.diagnosticsNa"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsRetries", {
                        value: activeDiagnostics.retryCount ?? 0,
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsResponseTime", {
                        value:
                          activeDiagnostics.responseDurationMs ?? t("assistant.modal.diagnosticsNa"),
                      })}
                    </li>
                    <li>
                      {t("assistant.modal.diagnosticsHistory", {
                        value: activeDiagnostics.conversationHistoryTurns ?? 0,
                      })}
                    </li>
                  </ul>
                  <p className="hu-assistant-modal__notice">
                    {t("assistant.modal.diagnosticsSafeNote")}
                  </p>
                </details>
              ) : null}
            </>
          ) : !loadError && !needsSignIn ? (
            <p className="hu-assistant-modal__notice" role="status">
              {t("assistant.modal.loading")}
            </p>
          ) : null}

          {assistError ? (
            <p className="hu-assistant-modal__error" role="alert">
              {assistError}
            </p>
          ) : null}
          {applyNotice ? (
            <p className="hu-assistant-modal__notice" role="status">
              {applyNotice}
            </p>
          ) : null}

          {result && context?.canApplySuggestionsToDraft ? (
            <div className="hu-assistant-modal__actions">
              <button type="button" className="secondary" onClick={handleUseSuggestions}>
                {t("assistant.modal.useSuggestion")}
              </button>
            </div>
          ) : null}
        </div>

        {context && !needsSignIn ? (
          <div className="hu-assistant-modal__footer">
            <div className="hu-assistant-modal__composer">
              <div className="hu-assistant-modal__input">
                <label>
                  <span>{t("assistant.modal.askLabel")}</span>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={t("assistant.modal.askPlaceholder")}
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
                  {busy ? t("assistant.modal.working") : t("assistant.modal.send")}
                </button>
                {context.allowedOperations.includes("explain") ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void runAssist("explain")}
                  >
                    {t("assistant.modal.explainContext")}
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
