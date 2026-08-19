"use client";

import { useEffect, useState } from "react";

import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactReport,
  InitiativePublicImpactReportSection,
} from "@hu/types";

import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  applyLifecycleAiSuggestionsToPublicImpactSections,
  setLifecycleAiDraftExcerpt,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant";
import {
  generateInitiativePublicImpactDraft,
  publishInitiativePublicImpactStage,
  saveInitiativePublicImpactDraft,
} from "../api";

interface InitiativePublicImpactEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativePublicImpactLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativePublicImpactLifecycleDraft) => void;
  readonly onPublished: (report: InitiativePublicImpactReport) => void;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Civic Archive" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativePublicImpactEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  onNavigate,
}: InitiativePublicImpactEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [sections, setSections] = useState<InitiativePublicImpactReportSection[]>(
    draft.sections.map((section) => structuredClone(section)),
  );
  const [error, setError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  useEffect(() => {
    setTitle(draft.title);
    setSections(draft.sections.map((section) => structuredClone(section)));
  }, [draft]);

  useEffect(() => {
    const excerpt = [
      `Title: ${title}`,
      ...sections.map((section) => `${section.sectionId}: ${section.body}`),
    ].join("\n");
    setLifecycleAiDraftExcerpt("public_impact", excerpt);
  }, [title, sections]);

  useEffect(() => {
    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "public_impact") {
        return;
      }

      const result = applyLifecycleAiSuggestionsToPublicImpactSections({
        title,
        sections,
        suggestions: detail.suggestions,
      });

      if (!result.applied) {
        return;
      }

      setTitle(result.title);
      setSections(result.sections);
      setApplyNotice(
        "AI suggestion applied locally. Edit as needed, then Save Draft. Nothing was published.",
      );
      setError(null);
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [initiativeId, sections, title]);

  function updateSection(sectionId: string, patch: Partial<InitiativePublicImpactReportSection>) {
    setSections((current) =>
      current.map((section) =>
        section.sectionId === sectionId ? { ...section, ...patch } : section,
      ),
    );
  }

  function buildSavePayload() {
    return {
      title,
      sections: sections.map((section) => ({
        ...section,
        evidenceReferences: section.evidenceReferences.map((reference) => reference.trim()).filter(Boolean),
      })),
      participationStatistics: draft.participationStatistics,
      officialResponsePackageId: draft.officialResponsePackageId,
      trackingPackageId: draft.trackingPackageId,
      commitmentPackageId: draft.commitmentPackageId,
      decisionId: draft.decisionId,
    };
  }

  async function handleGenerate() {
    setError(null);
    setApplyNotice(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativePublicImpactDraft(initiativeId),
      );
      setTitle(generated.title);
      setSections(generated.sections.map((section) => structuredClone(section)));
      onDraftUpdated(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativePublicImpactDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativePublicImpactDraft(initiativeId, buildSavePayload());
      const report = await publishPhase.runSave(() =>
        publishInitiativePublicImpactStage(initiativeId),
      );
      setPublished(true);
      onPublished(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="ipi-editor">
      <div className="ipi-editor__field">
        <label htmlFor="ipi-title">Title</label>
        <input id="ipi-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      {sections.length === 0 ? (
        <p className="ipi-source-panel__empty">
          No Report sections yet. Generate a draft from available Initiative Lifecycle sources.
        </p>
      ) : (
        sections.map((section) => (
          <div className="ipi-section" key={section.sectionId}>
            <div className="ipi-section__header">
              <h4 className="ipi-section__title">{section.title || section.sectionId}</h4>
              <span className="ipi-section__status">{section.sectionId}</span>
            </div>
            <div className="ipi-editor__field">
              <label htmlFor={`ipi-body-${section.sectionId}`}>Body</label>
              <textarea
                id={`ipi-body-${section.sectionId}`}
                rows={4}
                value={section.body}
                onChange={(event) => updateSection(section.sectionId, { body: event.target.value })}
              />
            </div>
            <div className="ipi-editor__field">
              <label htmlFor={`ipi-evidence-${section.sectionId}`}>
                Evidence References (one per line)
              </label>
              <textarea
                id={`ipi-evidence-${section.sectionId}`}
                rows={2}
                value={section.evidenceReferences.join("\n")}
                onChange={(event) =>
                  updateSection(section.sectionId, {
                    evidenceReferences: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        ))
      )}

      {error ? <p className="ipi-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="ipi-source-panel__empty">{applyNotice}</p> : null}

      <div className="ipi-editor__actions">
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
          {resolveSaveButtonLabel(publishPhase.phase, "Publish & Continue to Civic Archive")}
        </WorkspaceButton>
        {published && onNavigate ? (
          <WorkspaceButton
            variant="secondary"
            onClick={() => onNavigate("archive", "civic-archive")}
          >
            Open Civic Archive
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
