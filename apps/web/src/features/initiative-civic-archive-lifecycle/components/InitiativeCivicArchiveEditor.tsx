"use client";

import { useState } from "react";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveVersion,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import { requiresPublicImpactBeforeCivicArchive } from "../../public-initiative-experience/initiative-lifecycle-shell";
import {
  generateInitiativeCivicArchiveDraft,
  publishInitiativeCivicArchiveStage,
  saveInitiativeCivicArchiveDraft,
} from "../api";
import { InitiativeCivicArchiveCompletenessPanel } from "./InitiativeCivicArchiveCompletenessPanel";
import { InitiativeCivicArchiveShareToolbar } from "./InitiativeCivicArchiveShareToolbar";

interface InitiativeCivicArchiveEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeCivicArchiveLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeCivicArchiveLifecycleDraft) => void;
  readonly onPublished: (version: InitiativeCivicArchiveVersion) => void;
  readonly onTogglePreview: () => void;
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

export function InitiativeCivicArchiveEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  lifecycleProfile,
}: InitiativeCivicArchiveEditorProps) {
  const requirePublicImpact = requiresPublicImpactBeforeCivicArchive(lifecycleProfile);
  const [finalArchiveTitle, setFinalArchiveTitle] = useState(draft.finalArchiveTitle);
  const [finalSummary, setFinalSummary] = useState(draft.finalSummary);
  const [lessonsLearned, setLessonsLearned] = useState(draft.lessonsLearned);
  const [knowledgeContribution, setKnowledgeContribution] = useState(draft.knowledgeContribution);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  function buildSavePayload() {
    return {
      finalArchiveTitle,
      finalSummary,
      lessonsLearned,
      knowledgeContribution,
    };
  }

  async function handleGenerate() {
    setError(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeCivicArchiveDraft(initiativeId),
      );
      setFinalArchiveTitle(generated.finalArchiveTitle);
      setFinalSummary(generated.finalSummary);
      setLessonsLearned(generated.lessonsLearned);
      setKnowledgeContribution(generated.knowledgeContribution);
      onDraftUpdated(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativeCivicArchiveDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeCivicArchiveDraft(initiativeId, buildSavePayload());
      const version = await publishPhase.runSave(() =>
        publishInitiativeCivicArchiveStage(initiativeId),
      );
      setPublished(true);
      onPublished(version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="ica-editor">
      <InitiativeCivicArchiveShareToolbar initiativeId={initiativeId} mode="preview" />

      <InitiativeCivicArchiveCompletenessPanel
        completeness={draft.completeness}
        lifecycleProfile={lifecycleProfile}
      />

      <div className="ica-editor__field">
        <label htmlFor="ica-title">Final Archive Title</label>
        <input
          id="ica-title"
          value={finalArchiveTitle}
          onChange={(event) => setFinalArchiveTitle(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-summary">Final Summary</label>
        <textarea
          id="ica-summary"
          rows={3}
          value={finalSummary}
          onChange={(event) => setFinalSummary(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-lessons">Lessons Learned</label>
        <textarea
          id="ica-lessons"
          rows={4}
          value={lessonsLearned}
          onChange={(event) => setLessonsLearned(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-knowledge">Knowledge Contribution</label>
        <textarea
          id="ica-knowledge"
          rows={4}
          value={knowledgeContribution}
          onChange={(event) => setKnowledgeContribution(event.target.value)}
        />
      </div>

      <p className="ica-source-panel__empty">
        Assembled Archive sections are read-only historical structure. Regenerate to refresh them
        from published Lifecycle sources.
      </p>

      {draft.sections.length === 0 ? (
        <p className="ica-source-panel__empty">
          {requirePublicImpact
            ? "No Archive sections yet. Generate from the published Public Impact Report and upstream Lifecycle sources."
            : "No Archive sections yet. Generate from published Public Choice lifecycle sources (Collective Decision)."}
        </p>
      ) : (
        draft.sections.map((section) => (
          <div className="ica-section" key={section.sectionId}>
            <div className="ica-section__header">
              <h4 className="ica-section__title">{section.title || section.sectionId}</h4>
              <span className="ica-section__status">{section.sectionId}</span>
            </div>
            <p className="ica-section__body">
              {section.body.trim() || "No content recorded for this section."}
            </p>
          </div>
        ))
      )}

      {error ? <p className="ica-source-panel__empty">{error}</p> : null}
      {published ? (
        <p className="ica-source-panel__empty">
          Archive published. Use Public Preview to review the versioned document, or generate again
          to prepare the next Archive version.
        </p>
      ) : null}

      <div className="ica-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate")}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {resolveSaveButtonLabel(savePhase.phase, "Save Draft")}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>
          Preview
        </WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(publishPhase.phase, "Publish & Complete Initiative Lifecycle")}
        </WorkspaceButton>
      </div>
    </div>
  );
}
