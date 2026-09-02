"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { TranslateDraftControl } from "../../language";
import { useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { resolvePresentationStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton, WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  setLifecycleAiDraftExcerpt,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant";
import { applyLifecycleAiSuggestionsToFields } from "../../lifecycle-ai-assistant/lifecycle-ai-apply-suggestions";
import {
  generateInitiativeAnalysisDraft,
  publishInitiativeAnalysis,
  saveInitiativeAnalysisDraft,
  type SaveInitiativeCollaborativeAnalysisDraftInput,
} from "../api";

interface AnalysisFormState {
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  openQuestions: string;
  suggestedImprovements: string;
  references: string;
}

const ANALYSIS_FORM_SECTION_KEYS = [
  "title",
  "summary",
  "supportingEvidence",
  "risks",
  "openQuestions",
  "suggestedImprovements",
  "references",
] as const satisfies ReadonlyArray<keyof AnalysisFormState>;

interface InitiativeCollaborativeAnalysisFormProps {
  initiativeId: string;
  analysis: InitiativeCollaborativeAnalysis;
  onUpdated: (analysis: InitiativeCollaborativeAnalysis) => void;
  onTogglePreview: () => void;
}

function buildFormState(analysis: InitiativeCollaborativeAnalysis): AnalysisFormState {
  return {
    title: analysis.title,
    summary: analysis.summary,
    supportingEvidence: analysis.supportingEvidence,
    risks: analysis.risks,
    openQuestions: analysis.openQuestions ?? "",
    suggestedImprovements: analysis.suggestedImprovements,
    references: analysis.references,
  };
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part B, Section 5 (Analysis Editor).
 *
 * The Author's editable form for the Collaborative Analysis draft.
 * Autosave is not required (Section 5) — every field is local `useState`
 * until an explicit action (Save Draft / Publish) persists it. Generate
 * Draft, Save Draft, and Publish all use the existing Save-button
 * animation (`useSaveButtonPhase`), matching every other profile/save
 * button in this codebase. "Preview" is instantaneous (a local mode
 * toggle owned by the shell), so it gets no save-phase animation.
 *
 * Pack 02G 08D.4 — field/message chrome via author.analysis.*; shared
 * Save/Preview/Publish verbs via useAuthorActionLabels. Canonical form
 * values remain bound to AnalysisFormState.
 */
export function InitiativeCollaborativeAnalysisForm({
  initiativeId,
  analysis,
  onUpdated,
  onTogglePreview,
}: InitiativeCollaborativeAnalysisFormProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const [form, setForm] = useState<AnalysisFormState>(() => buildFormState(analysis));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  useEffect(() => {
    setForm(buildFormState(analysis));
    setMessage(null);
  }, [analysis]);

  useEffect(() => {
    setLifecycleAiDraftExcerpt(
      "analysis",
      [form.title, form.summary, form.supportingEvidence, form.risks, form.openQuestions]
        .filter((part) => part.trim())
        .join("\n\n"),
    );
  }, [form]);

  useEffect(() => {
    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "analysis") {
        return;
      }

      if (analysis.status !== "draft") {
        setMessage({
          tone: "error",
          text: t("author.analysis.messages.aiApplyDraftOnly"),
        });
        return;
      }

      setForm((current) => {
        const result = applyLifecycleAiSuggestionsToFields<AnalysisFormState>({
          current,
          suggestions: detail.suggestions,
          knownKeys: ANALYSIS_FORM_SECTION_KEYS,
          fallbackKey: "summary",
        });
        return result.applied ? result.next : current;
      });

      setMessage({
        tone: "success",
        text: t("author.analysis.messages.aiApplied"),
      });
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [analysis.status, initiativeId, t]);

  const isDraft = analysis.status === "draft";
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;
  const statusLabel =
    analysis.status === "archived"
      ? t("phases.archived")
      : resolvePresentationStatusDisplayLabel(analysis.status, t);

  async function handleGenerate() {
    if (isDraft && !window.confirm(t("author.analysis.confirm.generateOverwrite"))) {
      return;
    }

    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateInitiativeAnalysisDraft(initiativeId));
      onUpdated(updated);
      setMessage({ tone: "success", text: t("author.analysis.messages.draftGenerated") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.analysis.messages.generateFailed", {
          detail: detailFromError(error, t("author.analysis.messages.unknownError")),
        }),
      });
    }
  }

  async function handleSaveDraft() {
    setMessage(null);

    const input: SaveInitiativeCollaborativeAnalysisDraftInput = { ...form };

    try {
      const updated = await savePhase.runSave(() => saveInitiativeAnalysisDraft(analysis.analysisId, input));
      onUpdated(updated);
      setMessage({ tone: "success", text: t("author.analysis.messages.draftSaved") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.analysis.messages.saveFailed", {
          detail: detailFromError(error, t("author.analysis.messages.unknownError")),
        }),
      });
    }
  }

  async function handlePublish() {
    if (!window.confirm(t("author.analysis.confirm.publish"))) {
      return;
    }

    setMessage(null);

    try {
      const updated = await publishPhase.runSave(async () => {
        await saveInitiativeAnalysisDraft(analysis.analysisId, { ...form });
        return publishInitiativeAnalysis(analysis.analysisId);
      });
      onUpdated(updated);
      setMessage({ tone: "success", text: t("author.analysis.messages.published") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.analysis.messages.publishFailed", {
          detail: detailFromError(error, t("author.analysis.messages.unknownError")),
        }),
      });
    }
  }

  if (!isDraft) {
    return (
      <div className="ica-editor" aria-labelledby="ica-editor-title">
        <div className="ica-editor__status-row">
          <h3 id="ica-editor-title">{t("author.analysis.heading")}</h3>
          <WorkspaceStatusBadge status={analysis.status} label={statusLabel} />
        </div>
        <p className="ica-editor__readonly">
          {analysis.status === "published"
            ? t("author.analysis.readonly.published")
            : t("author.analysis.readonly.archived")}
        </p>
        <div className="ica-editor__actions">
          <WorkspaceButton variant="primary" disabled={isBusy} onClick={() => void handleGenerate()}>
            {actions.saveLabel(generatePhase.phase, actions.generateNewDraft)}
          </WorkspaceButton>
        </div>
        {message ? (
          <p className="ica-editor__message" data-tone={message.tone} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="ica-editor"
      aria-labelledby="ica-editor-title"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSaveDraft();
      }}
    >
      <div className="ica-editor__status-row">
        <h3 id="ica-editor-title">{t("author.analysis.editorTitle")}</h3>
        <WorkspaceStatusBadge status={analysis.status} label={statusLabel} />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-title-${analysis.analysisId}`}>{t("author.analysis.fields.title")}</label>
        <input
          id={`analysis-title-${analysis.analysisId}`}
          value={form.title}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-summary-${analysis.analysisId}`}>
          {t("author.analysis.fields.summary")}
        </label>
        <textarea
          id={`analysis-summary-${analysis.analysisId}`}
          value={form.summary}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-evidence-${analysis.analysisId}`}>
          {t("author.analysis.fields.supportingEvidence")}
        </label>
        <textarea
          id={`analysis-evidence-${analysis.analysisId}`}
          value={form.supportingEvidence}
          disabled={isBusy}
          onChange={(event) =>
            setForm((current) => ({ ...current, supportingEvidence: event.target.value }))
          }
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-risks-${analysis.analysisId}`}>{t("author.analysis.fields.risks")}</label>
        <textarea
          id={`analysis-risks-${analysis.analysisId}`}
          value={form.risks}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, risks: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-questions-${analysis.analysisId}`}>
          {t("author.analysis.fields.openQuestions")}
        </label>
        <textarea
          id={`analysis-questions-${analysis.analysisId}`}
          value={form.openQuestions}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, openQuestions: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-improvements-${analysis.analysisId}`}>
          {t("author.analysis.fields.suggestedImprovements")}
        </label>
        <textarea
          id={`analysis-improvements-${analysis.analysisId}`}
          value={form.suggestedImprovements}
          disabled={isBusy}
          onChange={(event) =>
            setForm((current) => ({ ...current, suggestedImprovements: event.target.value }))
          }
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-references-${analysis.analysisId}`}>
          {t("author.analysis.fields.references")}
        </label>
        <textarea
          id={`analysis-references-${analysis.analysisId}`}
          value={form.references}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, references: event.target.value }))}
        />
      </div>
      <p className="ica-editor__hint">{actions.autosaveHint}</p>

      <div className="ica-editor__actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, t("author.analysis.generateAnalysisDraft"))}
        </WorkspaceButton>
        <WorkspaceButton type="submit" variant="primary" disabled={isBusy}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          {actions.preview}
        </WorkspaceButton>
        <WorkspaceButton variant="primary" disabled={isBusy} onClick={() => void handlePublish()}>
          {actions.saveLabel(publishPhase.phase, actions.publish)}
        </WorkspaceButton>
      </div>

      {message ? (
        <p className="ica-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <TranslateDraftControl
        sourceKind="collaborative_analysis"
        sourceRecordId={analysis.analysisId}
        sourceVersion={analysis.updatedAt || analysis.createdAt || "draft"}
        initiativeId={initiativeId}
        draftContent={{ ...form }}
        onApplyWorkingTranslation={(fields) => {
          setForm((current) => ({
            ...current,
            title: fields.title ?? current.title,
            summary: fields.summary ?? current.summary,
            supportingEvidence: fields.supportingEvidence ?? current.supportingEvidence,
            risks: fields.risks ?? current.risks,
            openQuestions: fields.openQuestions ?? current.openQuestions,
            suggestedImprovements: fields.suggestedImprovements ?? current.suggestedImprovements,
            references: fields.references ?? current.references,
          }));
        }}
      />
    </form>
  );
}
