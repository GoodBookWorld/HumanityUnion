"use client";

import { useEffect, useState } from "react";

import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { TranslateDraftControl } from "../../language";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
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
 */
export function InitiativeCollaborativeAnalysisForm({
  initiativeId,
  analysis,
  onUpdated,
  onTogglePreview,
}: InitiativeCollaborativeAnalysisFormProps) {
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
          text: "AI suggestions can only be applied to an in-progress draft.",
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
        text: "AI suggestion applied locally. Edit as needed, then Save. Nothing was published.",
      });
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [analysis.status, initiativeId]);

  const isDraft = analysis.status === "draft";
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;

  async function handleGenerate() {
    if (
      isDraft &&
      !window.confirm(
        "Generating a new draft will overwrite the current Title, Summary, and all other fields below with a fresh derivation from Discussion. Continue?",
      )
    ) {
      return;
    }

    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateInitiativeAnalysisDraft(initiativeId));
      onUpdated(updated);
      setMessage({ tone: "success", text: "Draft generated from the current Source Snapshot." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Generate failed: ${detail}` });
    }
  }

  async function handleSaveDraft() {
    setMessage(null);

    const input: SaveInitiativeCollaborativeAnalysisDraftInput = { ...form };

    try {
      const updated = await savePhase.runSave(() => saveInitiativeAnalysisDraft(analysis.analysisId, input));
      onUpdated(updated);
      setMessage({ tone: "success", text: "Draft saved." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Save failed: ${detail}` });
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        "Publishing makes this Analysis visible to the public and notifies every Active Ally. Continue?",
      )
    ) {
      return;
    }

    setMessage(null);

    try {
      const updated = await publishPhase.runSave(async () => {
        await saveInitiativeAnalysisDraft(analysis.analysisId, { ...form });
        return publishInitiativeAnalysis(analysis.analysisId);
      });
      onUpdated(updated);
      setMessage({ tone: "success", text: "Analysis published. Active Allies have been notified." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Publish failed: ${detail}` });
    }
  }

  if (!isDraft) {
    return (
      <div className="ica-editor" aria-labelledby="ica-editor-title">
        <div className="ica-editor__status-row">
          <h3 id="ica-editor-title">Analysis</h3>
          <WorkspaceStatusBadge status={analysis.status} />
        </div>
        <p className="ica-editor__readonly">
          {analysis.status === "published"
            ? "This Analysis has been published and can no longer be edited. Generate a new draft to prepare an updated Analysis."
            : "This Analysis is archived and can no longer be edited."}
        </p>
        <div className="ica-editor__actions">
          <WorkspaceButton variant="primary" disabled={isBusy} onClick={() => void handleGenerate()}>
            {resolveSaveButtonLabel(generatePhase.phase, "Generate New Draft")}
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
        <h3 id="ica-editor-title">Analysis Editor</h3>
        <WorkspaceStatusBadge status={analysis.status} />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-title-${analysis.analysisId}`}>Title</label>
        <input
          id={`analysis-title-${analysis.analysisId}`}
          value={form.title}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-summary-${analysis.analysisId}`}>Executive Summary</label>
        <textarea
          id={`analysis-summary-${analysis.analysisId}`}
          value={form.summary}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-evidence-${analysis.analysisId}`}>Supporting Arguments</label>
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
        <label htmlFor={`analysis-risks-${analysis.analysisId}`}>Concerns</label>
        <textarea
          id={`analysis-risks-${analysis.analysisId}`}
          value={form.risks}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, risks: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-questions-${analysis.analysisId}`}>Open Questions</label>
        <textarea
          id={`analysis-questions-${analysis.analysisId}`}
          value={form.openQuestions}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, openQuestions: event.target.value }))}
        />
      </div>

      <div className="ica-editor__field">
        <label htmlFor={`analysis-improvements-${analysis.analysisId}`}>Recommendations</label>
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
        <label htmlFor={`analysis-references-${analysis.analysisId}`}>References</label>
        <textarea
          id={`analysis-references-${analysis.analysisId}`}
          value={form.references}
          disabled={isBusy}
          onChange={(event) => setForm((current) => ({ ...current, references: event.target.value }))}
        />
      </div>
      <p className="ica-editor__hint">Autosave is not enabled — use Save Draft to keep your changes.</p>

      <div className="ica-editor__actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate Draft")}
        </WorkspaceButton>
        <WorkspaceButton type="submit" variant="primary" disabled={isBusy}>
          {resolveSaveButtonLabel(savePhase.phase, "Save Draft")}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          Preview
        </WorkspaceButton>
        <WorkspaceButton variant="primary" disabled={isBusy} onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(publishPhase.phase, "Publish")}
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
