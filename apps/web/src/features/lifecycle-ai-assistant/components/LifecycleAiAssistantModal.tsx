"use client";

import { useEffect, useId, useRef, useState } from "react";

import type {
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleAiAssistResult,
  InitiativeLifecycleStageId,
  LifecycleAiAssistantSessionContext,
} from "@hu/types";

import { trapTabKey } from "../../../design-system/focus-trap";
import { getLifecycleAiSessionContext, requestLifecycleAiAssist } from "../api";
import { getLifecycleAiDraftExcerpt } from "../lifecycle-ai-draft-excerpt-bridge";
import { dispatchLifecycleAiApplySuggestions } from "../lifecycle-ai-suggestion-events";

import "../lifecycle-ai-assistant.css";

const PRIMARY_OPERATIONS: readonly InitiativeLifecycleAiAssistOperation[] = [
  "explain",
  "summarize_source_themes",
  "identify_missing_information",
  "improve_wording",
  "answer_question",
  "generate_draft",
];

const OPERATION_BUTTON_LABEL: Record<InitiativeLifecycleAiAssistOperation, string> = {
  generate_draft: "Generate",
  regenerate_section: "Regenerate section",
  improve_wording: "Improve",
  identify_missing_information: "Identify gaps",
  identify_contradictions: "Identify contradictions",
  summarize_source_themes: "Summarize",
  explain: "Explain",
  answer_question: "Answer question",
};

export interface LifecycleAiAssistantModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  /** Optional draft text for Improve / section ops — never private messages. */
  readonly currentDraftExcerpt?: string;
}

export function LifecycleAiAssistantModal({
  isOpen,
  onClose,
  initiativeId,
  stageId,
  currentDraftExcerpt,
}: LifecycleAiAssistantModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [context, setContext] = useState<LifecycleAiAssistantSessionContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyOperation, setBusyOperation] = useState<InitiativeLifecycleAiAssistOperation | null>(
    null,
  );
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<InitiativeLifecycleAiAssistResult | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setAssistError(null);
    setApplyNotice(null);
    setResult(null);

    getLifecycleAiSessionContext(initiativeId, stageId)
      .then((session) => {
        if (!cancelled) {
          setContext(session);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setContext(null);
          setLoadError(error instanceof Error ? error.message : "Could not load assistant context.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, isOpen, stageId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const allowed = new Set(context?.allowedOperations ?? []);
  const visibleOperations = PRIMARY_OPERATIONS.filter((operation) => allowed.has(operation));

  async function runOperation(operation: InitiativeLifecycleAiAssistOperation) {
    setBusyOperation(operation);
    setAssistError(null);
    setApplyNotice(null);

    try {
      const assistResult = await requestLifecycleAiAssist({
        initiativeId,
        stageId,
        operation,
        instructions: operation === "answer_question" ? question.trim() || undefined : undefined,
        currentDraftExcerpt:
          operation === "improve_wording" || operation === "regenerate_section"
            ? currentDraftExcerpt ||
              getLifecycleAiDraftExcerpt(stageId ?? "analysis") ||
              undefined
            : undefined,
      });

      if (assistResult.autoApplied || assistResult.autoPublished) {
        throw new Error("AI attempted an automatic edit or publication, which is forbidden.");
      }

      setResult(assistResult);
    } catch (error) {
      setResult(null);
      const raw = error instanceof Error ? error.message : "";
      const calm =
        /temporarily unavailable|could not be processed safely|not configured|Author Workspace|not found|could not be completed/i.test(
          raw,
        )
          ? raw
          : "The assistant is temporarily unavailable.";
      setAssistError(calm || "The assistant is temporarily unavailable.");
    } finally {
      setBusyOperation(null);
    }
  }

  function handleUseSuggestions() {
    if (!result || result.suggestions.length === 0) {
      return;
    }

    dispatchLifecycleAiApplySuggestions({
      initiativeId,
      stageId,
      suggestions: result.suggestions,
    });
    setApplyNotice(
      "Suggestion copied into your draft editor locally. Edit it, then Save → Preview → Publish. Nothing was published automatically.",
    );
  }

  return (
    <div className="lifecycle-ai-modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="lifecycle-ai-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lifecycle-ai-modal__header">
          <div>
            <h2 id={titleId} className="lifecycle-ai-modal__title">
              Ask Assistant
            </h2>
            <p className="lifecycle-ai-modal__subtitle">
              Ask for a suggestion, then edit and save yourself. AI never publishes.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="lifecycle-ai-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loadError ? <p className="lifecycle-ai-modal__error">{loadError}</p> : null}

        {context ? (
          <>
            <dl className="lifecycle-ai-modal__context">
              <dt>Participant</dt>
              <dd>{context.participantDisplayName}</dd>
              <dt>Initiative</dt>
              <dd>{context.initiativeTitle}</dd>
              <dt>Lifecycle Stage</dt>
              <dd>{context.stageLabel}</dd>
              <dt>Presentation Mode</dt>
              <dd>{context.presentationMode}</dd>
              <dt>Available stage sources</dt>
              <dd>{context.availableSourceLabels.join(" · ") || "None listed"}</dd>
              <dt>Allowed actions</dt>
              <dd>{context.allowedActionLabels.join(" · ") || "None"}</dd>
              <dt>Provider</dt>
              <dd>
                {context.providerId}
                {context.providerReady ? "" : " (not ready)"}
                {context.diagnostics
                  ? ` · diagnostics: configured=${context.diagnostics.configuredProvider}, active=${context.diagnostics.activeProviderId}`
                  : ""}
              </dd>
            </dl>

            <p className="lifecycle-ai-modal__notice">Humanity Union principles</p>
            <ul className="lifecycle-ai-modal__principles">
              {context.humanityUnionPrinciples.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ul>

            <div className="lifecycle-ai-modal__actions" role="group" aria-label="AI assist actions">
              {visibleOperations.map((operation) => (
                <button
                  key={operation}
                  type="button"
                  disabled={busyOperation !== null}
                  aria-pressed={busyOperation === operation}
                  onClick={() => void runOperation(operation)}
                >
                  {busyOperation === operation
                    ? "Working…"
                    : OPERATION_BUTTON_LABEL[operation]}
                </button>
              ))}
            </div>

            {allowed.has("answer_question") ? (
              <label className="lifecycle-ai-modal__question">
                <span>Question for the assistant</span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about this Lifecycle stage, Workspace terms, or your draft…"
                />
              </label>
            ) : null}

            <p className="lifecycle-ai-modal__notice">
              Workflow: Ask Assistant → receive suggestion → author edits → Save → Preview → Publish.
              Private chats and credentials are never sent automatically.
            </p>
          </>
        ) : !loadError ? (
          <p className="lifecycle-ai-modal__notice">Loading assistant context…</p>
        ) : null}

        {assistError ? <p className="lifecycle-ai-modal__error">{assistError}</p> : null}
        {applyNotice ? <p className="lifecycle-ai-modal__notice">{applyNotice}</p> : null}

        {result ? (
          <div className="lifecycle-ai-modal__suggestions">
            <p className="lifecycle-ai-modal__notice">
              Response provider: {result.providerId}
              {result.diagnostics
                ? ` (configured=${result.diagnostics.configuredProvider}, active=${result.diagnostics.activeProviderId})`
                : ""}
              {" · "}
              autoApplied={String(result.autoApplied)} · autoPublished={String(result.autoPublished)}
            </p>
            {result.suggestions.map((suggestion) => (
              <article key={suggestion.suggestionId} className="lifecycle-ai-modal__suggestion">
                <h3>{suggestion.targetSectionId ?? "Assistant reply"}</h3>
                <p className="lifecycle-ai-modal__suggestion-meta">{suggestion.provenanceNote}</p>
                <p>{suggestion.suggestedText}</p>
              </article>
            ))}
            <div className="lifecycle-ai-modal__actions">
              <button type="button" onClick={handleUseSuggestions}>
                Use suggestion in draft editor
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
