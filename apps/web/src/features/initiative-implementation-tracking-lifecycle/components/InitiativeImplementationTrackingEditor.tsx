"use client";

import { useState } from "react";

import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingPackage,
} from "@hu/types";

import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeImplementationTrackingDraft,
  publishInitiativeImplementationTrackingStage,
  saveInitiativeImplementationTrackingDraft,
} from "../api";

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: readonly string[]): string {
  return values.join("\n");
}

interface CandidateFormState {
  candidateId: string;
  commitmentId: string;
  approvedAction: string;
  responsibleParticipantId: string;
  currentStatus: string;
  progress: string;
  targetDate: string;
  startedDate: string;
  completedDate: string;
  dependencies: string;
  obstacles: string;
  evidenceReferences: string;
  notes: string;
}

function toFormState(candidate: InitiativeImplementationTrackingCandidate): CandidateFormState {
  return {
    candidateId: candidate.candidateId,
    commitmentId: candidate.commitmentId,
    approvedAction: candidate.approvedAction,
    responsibleParticipantId: candidate.responsibleParticipantId,
    currentStatus: candidate.currentStatus,
    progress: String(candidate.progress),
    targetDate: candidate.targetDate ?? "",
    startedDate: candidate.startedDate ?? "",
    completedDate: candidate.completedDate ?? "",
    dependencies: listToLines(candidate.dependencies),
    obstacles: listToLines(candidate.obstacles),
    evidenceReferences: listToLines(candidate.evidenceReferences),
    notes: candidate.notes,
  };
}

function fromFormState(state: CandidateFormState): InitiativeImplementationTrackingCandidate {
  const progress = Number(state.progress);

  return {
    candidateId: state.candidateId,
    commitmentId: state.commitmentId,
    approvedAction: state.approvedAction,
    responsibleParticipantId: state.responsibleParticipantId,
    currentStatus: state.currentStatus,
    progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0,
    targetDate: state.targetDate.trim() || null,
    startedDate: state.startedDate.trim() || null,
    completedDate: state.completedDate.trim() || null,
    dependencies: linesToList(state.dependencies),
    obstacles: linesToList(state.obstacles),
    evidenceReferences: linesToList(state.evidenceReferences),
    notes: state.notes,
  };
}

interface InitiativeImplementationTrackingEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeImplementationTrackingLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeImplementationTrackingLifecycleDraft) => void;
  readonly onPublished: (pkg: InitiativeImplementationTrackingPackage) => void;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Official Responses" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeImplementationTrackingEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  onNavigate,
}: InitiativeImplementationTrackingEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary);
  const [candidates, setCandidates] = useState<CandidateFormState[]>(
    draft.candidates.map((candidate) => toFormState(candidate)),
  );
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  function updateCandidate(candidateId: string, patch: Partial<CandidateFormState>) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.candidateId === candidateId ? { ...candidate, ...patch } : candidate,
      ),
    );
  }

  function buildSavePayload() {
    return {
      title,
      summary,
      candidates: candidates.map((candidate) => fromFormState(candidate)),
    };
  }

  async function handleGenerate() {
    setError(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeImplementationTrackingDraft(initiativeId),
      );
      setTitle(generated.title);
      setSummary(generated.summary);
      setCandidates(generated.candidates.map((candidate) => toFormState(candidate)));
      onDraftUpdated(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativeImplementationTrackingDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeImplementationTrackingDraft(initiativeId, buildSavePayload());
      const pkg = await publishPhase.runSave(() =>
        publishInitiativeImplementationTrackingStage(initiativeId),
      );
      setPublished(true);
      onPublished(pkg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="iit-editor">
      <div className="iit-editor__field">
        <label htmlFor="iit-title">Title</label>
        <input id="iit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="iit-editor__field">
        <label htmlFor="iit-summary">Summary</label>
        <textarea
          id="iit-summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>

      {candidates.length === 0 ? (
        <p className="iit-source-panel__empty">
          No Tracking Candidates yet. Generate a draft from the published Implementation
          Commitments&rsquo; Accepted Commitments.
        </p>
      ) : (
        candidates.map((candidate, index) => (
          <div className="iit-candidate" key={candidate.candidateId}>
            <div className="iit-candidate__header">
              <h4 className="iit-candidate__title">
                Action {index + 1}: {candidate.approvedAction}
              </h4>
              <span className="iit-candidate__status">{candidate.currentStatus}</span>
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-status-${candidate.candidateId}`}>Current Status</label>
              <input
                id={`iit-status-${candidate.candidateId}`}
                value={candidate.currentStatus}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { currentStatus: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-progress-${candidate.candidateId}`}>Progress (%)</label>
              <input
                id={`iit-progress-${candidate.candidateId}`}
                type="number"
                min={0}
                max={100}
                value={candidate.progress}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { progress: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-responsible-${candidate.candidateId}`}>Responsible Participant ID</label>
              <input
                id={`iit-responsible-${candidate.candidateId}`}
                value={candidate.responsibleParticipantId}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, {
                    responsibleParticipantId: event.target.value,
                  })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-target-${candidate.candidateId}`}>Target Date</label>
              <input
                id={`iit-target-${candidate.candidateId}`}
                type="date"
                value={candidate.targetDate}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { targetDate: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-dependencies-${candidate.candidateId}`}>Dependencies (one per line)</label>
              <textarea
                id={`iit-dependencies-${candidate.candidateId}`}
                rows={2}
                value={candidate.dependencies}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { dependencies: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-obstacles-${candidate.candidateId}`}>Obstacles (one per line)</label>
              <textarea
                id={`iit-obstacles-${candidate.candidateId}`}
                rows={2}
                value={candidate.obstacles}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { obstacles: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-evidence-${candidate.candidateId}`}>Evidence References (one per line)</label>
              <textarea
                id={`iit-evidence-${candidate.candidateId}`}
                rows={2}
                value={candidate.evidenceReferences}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { evidenceReferences: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-notes-${candidate.candidateId}`}>Notes</label>
              <textarea
                id={`iit-notes-${candidate.candidateId}`}
                rows={2}
                value={candidate.notes}
                onChange={(event) => updateCandidate(candidate.candidateId, { notes: event.target.value })}
              />
            </div>
          </div>
        ))
      )}

      {error ? <p className="iit-source-panel__empty">{error}</p> : null}

      <div className="iit-editor__actions">
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
          {resolveSaveButtonLabel(publishPhase.phase, "Publish")}
        </WorkspaceButton>
        {published && onNavigate ? (
          <WorkspaceButton
            variant="secondary"
            onClick={() => onNavigate("official_response", "official-responses")}
          >
            Open Official Responses
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
