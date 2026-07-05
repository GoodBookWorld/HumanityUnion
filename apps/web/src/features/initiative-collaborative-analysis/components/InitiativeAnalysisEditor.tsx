"use client";

import type { InitiativeCollaborativeAnalysis } from "@hu/types";
import { useEffect, useState } from "react";

import {
  archiveInitiativeAnalysis,
  publishInitiativeAnalysis,
  saveInitiativeAnalysisDraft,
  type SaveInitiativeCollaborativeAnalysisDraftInput,
} from "../api";

import "./initiative-analysis-editor.css";

interface AnalysisFormState {
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  suggestedImprovements: string;
  references: string;
}

interface InitiativeAnalysisEditorProps {
  analysis: InitiativeCollaborativeAnalysis;
  onUpdated: (analysis: InitiativeCollaborativeAnalysis) => void;
}

function buildFormState(analysis: InitiativeCollaborativeAnalysis): AnalysisFormState {
  return {
    title: analysis.title,
    summary: analysis.summary,
    supportingEvidence: analysis.supportingEvidence,
    risks: analysis.risks,
    suggestedImprovements: analysis.suggestedImprovements,
    references: analysis.references,
  };
}

export function InitiativeAnalysisEditor({ analysis, onUpdated }: InitiativeAnalysisEditorProps) {
  const [form, setForm] = useState<AnalysisFormState>(() => buildFormState(analysis));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(analysis));
    setMessage(null);
  }, [analysis]);

  const isDraft = analysis.status === "draft";
  const isPublished = analysis.status === "published";
  const isArchived = analysis.status === "archived";

  async function handleSaveDraft() {
    setSaving(true);
    setMessage(null);

    const input: SaveInitiativeCollaborativeAnalysisDraftInput = { ...form };

    try {
      const updated = await saveInitiativeAnalysisDraft(analysis.analysisId, input);
      onUpdated(updated);
      setMessage("Draft saved.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Save failed: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);

    try {
      await saveInitiativeAnalysisDraft(analysis.analysisId, { ...form });
      const updated = await publishInitiativeAnalysis(analysis.analysisId);
      onUpdated(updated);
      setMessage("Analysis published.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Publish failed: ${detail}`);
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const updated = await archiveInitiativeAnalysis(analysis.analysisId);
      onUpdated(updated);
      setMessage("Analysis archived.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Archive failed: ${detail}`);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="initiative-analysis-editor">
      <p className="initiative-analysis-editor__status">Status: {analysis.status}</p>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-title-${analysis.analysisId}`}>Analysis title</label>
        <input
          id={`analysis-title-${analysis.analysisId}`}
          value={form.title}
          disabled={!isDraft}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-summary-${analysis.analysisId}`}>Summary</label>
        <textarea
          id={`analysis-summary-${analysis.analysisId}`}
          value={form.summary}
          disabled={!isDraft}
          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </div>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-evidence-${analysis.analysisId}`}>Supporting evidence</label>
        <textarea
          id={`analysis-evidence-${analysis.analysisId}`}
          value={form.supportingEvidence}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, supportingEvidence: event.target.value }))
          }
        />
      </div>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-risks-${analysis.analysisId}`}>Risks</label>
        <textarea
          id={`analysis-risks-${analysis.analysisId}`}
          value={form.risks}
          disabled={!isDraft}
          onChange={(event) => setForm((current) => ({ ...current, risks: event.target.value }))}
        />
      </div>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-improvements-${analysis.analysisId}`}>
          Suggested improvements
        </label>
        <textarea
          id={`analysis-improvements-${analysis.analysisId}`}
          value={form.suggestedImprovements}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, suggestedImprovements: event.target.value }))
          }
        />
      </div>

      <div className="initiative-analysis-editor__field">
        <label htmlFor={`analysis-references-${analysis.analysisId}`}>References</label>
        <textarea
          id={`analysis-references-${analysis.analysisId}`}
          value={form.references}
          disabled={!isDraft}
          onChange={(event) =>
            setForm((current) => ({ ...current, references: event.target.value }))
          }
        />
      </div>

      <div className="initiative-analysis-editor__actions">
        {isDraft ? (
          <>
            <button type="button" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" disabled={publishing} onClick={() => void handlePublish()}>
              {publishing ? "Publishing..." : "Publish"}
            </button>
            <button
              type="button"
              data-variant="secondary"
              disabled={archiving}
              onClick={() => void handleArchive()}
            >
              {archiving ? "Archiving..." : "Archive"}
            </button>
          </>
        ) : null}
        {isPublished ? (
          <button
            type="button"
            data-variant="secondary"
            disabled={archiving}
            onClick={() => void handleArchive()}
          >
            {archiving ? "Archiving..." : "Archive"}
          </button>
        ) : null}
        {isArchived ? <p>This analysis is archived and cannot be edited.</p> : null}
      </div>

      {message ? <p className="initiative-analysis-editor__message">{message}</p> : null}
    </div>
  );
}
