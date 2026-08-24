"use client";

import { useEffect, useState } from "react";

import type {
  BlogPublicationOptimization,
  HumanityUnionAssistantAssistResult,
  InitiativeLifecycleAiAssistOperation,
} from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { requestHumanityUnionAssistantAssist } from "../../humanity-union-assistant/api";
import { useOptionalHumanityUnionAssistant } from "../../humanity-union-assistant/assistant-context";
import {
  clearLifecycleAiDraftExcerpt,
  setLifecycleAiDraftExcerpt,
} from "../../lifecycle-ai-assistant/lifecycle-ai-draft-excerpt-bridge";
import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant/lifecycle-ai-suggestion-events";

/** Shared with API Pack 16D stage key — keep in sync with blog-authoring-assistant.ts */
export const BLOG_AUTHORING_ASSISTANT_STAGE_KEY = "blog_authoring";

export type BlogAuthoringAssistantField =
  | "title"
  | "content"
  | "excerpt"
  | "seoTitle"
  | "seoDescription"
  | "keywords"
  | "socialTitle"
  | "socialDescription"
  | "structure"
  | "clarity";

interface PendingSuggestion {
  readonly suggestionId: string;
  readonly field: BlogAuthoringAssistantField;
  readonly label: string;
  readonly proposedText: string;
  readonly provenanceNote: string;
  readonly requiresConfirm: boolean;
}

export interface BlogAuthoringAssistantPanelProps {
  readonly postId: string | null;
  readonly title: string;
  readonly excerpt: string;
  readonly content: string;
  readonly optimization: BlogPublicationOptimization;
  readonly disabled?: boolean;
  readonly onApplyField: (input: {
    readonly field: BlogAuthoringAssistantField;
    readonly text: string;
    readonly mode: "apply" | "replace";
  }) => void;
}

const ACTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly field: BlogAuthoringAssistantField;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly instructions: string;
  readonly requiresConfirm: boolean;
}[] = [
  {
    id: "title",
    label: "Title suggestions",
    field: "title",
    operation: "regenerate_section",
    instructions: "Suggest an improved publication title. Keep it accurate and Author-owned.",
    requiresConfirm: false,
  },
  {
    id: "content",
    label: "Text correction",
    field: "content",
    operation: "improve_wording",
    instructions: "Suggest a careful text correction for the article body. Preserve the Author voice.",
    requiresConfirm: true,
  },
  {
    id: "clarity",
    label: "Clarity / readability",
    field: "clarity",
    operation: "improve_wording",
    instructions: "Suggest clarity and readability improvements for this publication draft.",
    requiresConfirm: false,
  },
  {
    id: "structure",
    label: "Structure suggestions",
    field: "structure",
    operation: "identify_missing_information",
    instructions: "Suggest structure improvements (outline, section order, headings).",
    requiresConfirm: false,
  },
  {
    id: "seoTitle",
    label: "SEO title",
    field: "seoTitle",
    operation: "regenerate_section",
    instructions: "Suggest an SEO title for search results (about 60 characters).",
    requiresConfirm: false,
  },
  {
    id: "seoDescription",
    label: "Meta description",
    field: "seoDescription",
    operation: "regenerate_section",
    instructions: "Suggest a meta description for search results (about 150–160 characters).",
    requiresConfirm: false,
  },
  {
    id: "keywords",
    label: "Keywords / topics",
    field: "keywords",
    operation: "identify_missing_information",
    instructions: "Suggest keywords and topics as a short comma-separated list.",
    requiresConfirm: false,
  },
  {
    id: "social",
    label: "Social preview",
    field: "socialTitle",
    operation: "regenerate_section",
    instructions: "Suggest social preview title and description for share cards.",
    requiresConfirm: false,
  },
];

function mapSectionToField(sectionId: string | null | undefined): BlogAuthoringAssistantField | null {
  switch (sectionId) {
    case "title":
      return "title";
    case "content":
      return "content";
    case "clarity":
      return "clarity";
    case "structure":
      return "structure";
    case "seoTitle":
      return "seoTitle";
    case "seoDescription":
      return "seoDescription";
    case "keywords":
      return "keywords";
    case "socialTitle":
      return "socialTitle";
    case "socialDescription":
      return "socialDescription";
    case "excerpt":
      return "excerpt";
    default:
      return null;
  }
}

function fieldLabel(field: BlogAuthoringAssistantField): string {
  switch (field) {
    case "title":
      return "Title";
    case "content":
      return "Article content";
    case "excerpt":
      return "Excerpt";
    case "seoTitle":
      return "SEO title";
    case "seoDescription":
      return "Meta description";
    case "keywords":
      return "Keywords / topics";
    case "socialTitle":
      return "Social title";
    case "socialDescription":
      return "Social description";
    case "structure":
      return "Structure";
    case "clarity":
      return "Clarity";
    default:
      return field;
  }
}

function buildDraftExcerpt(input: {
  title: string;
  excerpt: string;
  content: string;
  optimization: BlogPublicationOptimization;
}): string {
  const plainContent = input.content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  return [
    `title: ${input.title.trim() || "(untitled)"}`,
    `excerpt: ${input.excerpt.trim() || "(none)"}`,
    `seoTitle: ${input.optimization.seoTitle?.trim() || "(none)"}`,
    `seoDescription: ${input.optimization.seoDescription?.trim() || "(none)"}`,
    `socialTitle: ${input.optimization.socialTitle?.trim() || "(none)"}`,
    `socialDescription: ${input.optimization.socialDescription?.trim() || "(none)"}`,
    `content:\n${plainContent || "(empty)"}`,
  ].join("\n");
}

export function BlogAuthoringAssistantPanel({
  postId,
  title,
  excerpt,
  content,
  optimization,
  disabled,
  onApplyField,
}: BlogAuthoringAssistantPanelProps) {
  const assistant = useOptionalHumanityUnionAssistant();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSuggestion[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const excerptText = buildDraftExcerpt({ title, excerpt, content, optimization });
    setLifecycleAiDraftExcerpt(BLOG_AUTHORING_ASSISTANT_STAGE_KEY, excerptText);
    return () => clearLifecycleAiDraftExcerpt(BLOG_AUTHORING_ASSISTANT_STAGE_KEY);
  }, [title, excerpt, content, optimization]);

  useEffect(() => {
    const onApply = (event: Event) => {
      const detail = (event as CustomEvent<LifecycleAiApplySuggestionsDetail>).detail;
      if (!detail || detail.stageId !== BLOG_AUTHORING_ASSISTANT_STAGE_KEY) {
        return;
      }
      const next: PendingSuggestion[] = detail.suggestions
        .map((suggestion) => {
          const field = mapSectionToField(suggestion.targetSectionId) ?? "clarity";
          return {
            suggestionId: suggestion.suggestionId,
            field,
            label: fieldLabel(field),
            proposedText: suggestion.suggestedText.trim(),
            provenanceNote: suggestion.provenanceNote,
            requiresConfirm: field === "content" || suggestion.suggestedText.length > 800,
          };
        })
        .filter((row) => row.proposedText.length > 0);
      if (next.length === 0) {
        return;
      }
      setPending((current) => [...next, ...current].slice(0, 12));
      setNotice(
        "Assistant suggestions arrived. Review each one — Apply / Replace / Dismiss. Nothing was saved or published.",
      );
    };
    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, onApply as EventListener);
    return () =>
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, onApply as EventListener);
  }, []);

  async function runAction(actionId: string): Promise<void> {
    const action = ACTIONS.find((entry) => entry.id === actionId);
    if (!action || disabled) {
      return;
    }
    setBusyAction(actionId);
    setError(null);
    setNotice(null);
    try {
      const pagePath =
        typeof window !== "undefined" ? window.location.pathname : "/workspace/publishing/new";
      const draftExcerpt = buildDraftExcerpt({ title, excerpt, content, optimization });
      const result: HumanityUnionAssistantAssistResult = await requestHumanityUnionAssistantAssist({
        surfaceId: "blog",
        pagePath,
        operation: action.operation,
        targetSectionId: action.field,
        instructions: action.instructions,
        currentDraftExcerpt: draftExcerpt,
      });

      if (result.autoApplied || result.autoPublished) {
        throw new Error("Assistant returned an invalid auto-apply/publish response.");
      }

      const rows: PendingSuggestion[] = result.suggestions
        .map((suggestion) => {
          const field =
            mapSectionToField(suggestion.targetSectionId) ??
            (action.id === "social" && suggestion.targetSectionId === "socialDescription"
              ? "socialDescription"
              : action.field);
          return {
            suggestionId: suggestion.suggestionId,
            field,
            label: fieldLabel(field),
            proposedText: suggestion.suggestedText.trim(),
            provenanceNote: suggestion.provenanceNote,
            requiresConfirm: action.requiresConfirm || suggestion.suggestedText.length > 800,
          };
        })
        .filter((row) => row.proposedText.length > 0);

      if (action.id === "social" && rows.every((row) => row.field === "socialTitle")) {
        const socialDesc = result.suggestions.find((s) => s.targetSectionId === "socialDescription");
        if (socialDesc?.suggestedText.trim()) {
          rows.push({
            suggestionId: `${socialDesc.suggestionId}-desc`,
            field: "socialDescription",
            label: fieldLabel("socialDescription"),
            proposedText: socialDesc.suggestedText.trim(),
            provenanceNote: socialDesc.provenanceNote,
            requiresConfirm: false,
          });
        }
      }

      if (rows.length === 0) {
        setError("The Assistant returned no usable suggestions. Try again or rephrase.");
        return;
      }
      setPending((current) => [...rows, ...current].slice(0, 12));
      setNotice("Suggestions ready. Explicitly Apply, Replace, or Dismiss — nothing auto-saves.");
    } catch (assistError) {
      if (isAuthenticationRequiredError(assistError)) {
        setError("Sign in to use the Humanity Union Assistant.");
      } else {
        setError(
          formatAuthFormError(assistError) ||
            "The Assistant is temporarily unavailable. Your editor still works.",
        );
      }
    } finally {
      setBusyAction(null);
    }
  }

  function dismissSuggestion(suggestionId: string): void {
    setPending((current) => current.filter((row) => row.suggestionId !== suggestionId));
    if (confirmId === suggestionId) {
      setConfirmId(null);
    }
  }

  function applySuggestion(row: PendingSuggestion, mode: "apply" | "replace"): void {
    if (row.requiresConfirm && confirmId !== row.suggestionId) {
      setConfirmId(row.suggestionId);
      return;
    }
    onApplyField({ field: row.field, text: row.proposedText, mode });
    dismissSuggestion(row.suggestionId);
    setNotice(
      `${mode === "replace" ? "Replaced" : "Applied"} ${row.label} locally. Review, then Save Draft when ready — Assistant never publishes.`,
    );
  }

  return (
    <section
      className="blog-authoring-assistant"
      aria-label="Humanity Union Assistant"
      data-post-id={postId ?? "new"}
    >
      <HelperText>
        Ask for optional suggestions. You Apply, Replace, or Dismiss each one. The Assistant never
        silently rewrites, saves, submits, or publishes.
      </HelperText>

      {assistant ? (
        <Button
          type="button"
          variant="primary"
          className="blog-authoring-assistant__open-chat"
          disabled={disabled}
          onClick={() =>
            assistant.openAssistant({
              surfaceId: "blog",
              pagePath:
                typeof window !== "undefined"
                  ? window.location.pathname
                  : "/workspace/publishing/new",
            })
          }
        >
          Open chat
        </Button>
      ) : null}

      <div className="blog-authoring-assistant__actions">
        {ACTIONS.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="secondary"
            className="hu-button--sm"
            disabled={disabled || busyAction !== null}
            onClick={() => {
              void runAction(action.id);
            }}
          >
            {busyAction === action.id ? "Asking…" : action.label}
          </Button>
        ))}
      </div>

      {error ? <StatusBanner title="Assistant unavailable" message={error} /> : null}
      {notice ? <p className="hu-caption blog-authoring-assistant__notice">{notice}</p> : null}

      {pending.length > 0 ? (
        <ul className="blog-authoring-assistant__suggestions">
          {pending.map((row) => (
            <li key={row.suggestionId} className="blog-authoring-assistant__suggestion">
              <p className="hu-label">{row.label}</p>
              <p className="hu-caption">{row.provenanceNote}</p>
              <pre className="blog-authoring-assistant__proposal">{row.proposedText}</pre>
              {confirmId === row.suggestionId ? (
                <div className="blog-authoring-assistant__confirm">
                  <p className="hu-caption">
                    Large change — confirm before replacing your current {row.label.toLowerCase()}.
                  </p>
                  <div className="hu-form-actions">
                    <Button
                      type="button"
                      variant="primary"
                      className="hu-button--sm"
                      onClick={() => applySuggestion(row, "replace")}
                    >
                      Confirm replace
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      className="hu-button--sm"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="hu-form-actions">
                  <Button
                    type="button"
                    variant="primary"
                    className="hu-button--sm"
                    disabled={disabled}
                    onClick={() => applySuggestion(row, "apply")}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="hu-button--sm"
                    disabled={disabled}
                    onClick={() => applySuggestion(row, "replace")}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    className="hu-button--sm"
                    onClick={() => dismissSuggestion(row.suggestionId)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hu-caption">No pending suggestions. Choose a request above when you want help.</p>
      )}
    </section>
  );
}
