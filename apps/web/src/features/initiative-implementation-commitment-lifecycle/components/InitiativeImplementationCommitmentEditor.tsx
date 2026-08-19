"use client";

import { useEffect, useState } from "react";

import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentLifecycleDraft,
  InitiativeImplementationCommitmentPackage,
} from "@hu/types";

import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  applyLifecycleAiSuggestionsToCandidateCollection,
  getLifecycleAiStageApplyContract,
  setLifecycleAiDraftExcerpt,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeImplementationCommitmentDraft,
  publishInitiativeImplementationCommitmentStage,
  saveInitiativeImplementationCommitmentDraft,
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
  approvedAction: string;
  description: string;
  suggestedResponsibleRole: string;
  suggestedTimeline: string;
  priority: string;
  requiredResources: string;
  relatedRisks: string;
  references: string;
  proposedParticipantId: string;
}

function toFormState(candidate: InitiativeImplementationCommitmentCandidate): CandidateFormState {
  return {
    candidateId: candidate.candidateId,
    approvedAction: candidate.approvedAction,
    description: candidate.description,
    suggestedResponsibleRole: candidate.suggestedResponsibleRole,
    suggestedTimeline: candidate.suggestedTimeline,
    priority: candidate.priority,
    requiredResources: listToLines(candidate.requiredResources),
    relatedRisks: listToLines(candidate.relatedRisks),
    references: listToLines(candidate.references),
    proposedParticipantId: candidate.proposedParticipantId ?? "",
  };
}

function fromFormState(state: CandidateFormState): InitiativeImplementationCommitmentCandidate {
  return {
    candidateId: state.candidateId,
    approvedAction: state.approvedAction,
    description: state.description,
    suggestedResponsibleRole: state.suggestedResponsibleRole,
    suggestedTimeline: state.suggestedTimeline,
    priority: state.priority,
    requiredResources: linesToList(state.requiredResources),
    relatedRisks: linesToList(state.relatedRisks),
    references: linesToList(state.references),
    proposedParticipantId: state.proposedParticipantId.trim() || null,
    status: "draft",
  };
}

interface InitiativeImplementationCommitmentEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeImplementationCommitmentLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeImplementationCommitmentLifecycleDraft) => void;
  readonly onPublished: (pkg: InitiativeImplementationCommitmentPackage) => void;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Tracking" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeImplementationCommitmentEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  onNavigate,
}: InitiativeImplementationCommitmentEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary);
  const [candidates, setCandidates] = useState<CandidateFormState[]>(
    draft.candidates.map((candidate) => toFormState(candidate)),
  );
  const [error, setError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  useEffect(() => {
    const excerpt = [
      `Title: ${title}`,
      `Summary: ${summary}`,
      ...candidates.map(
        (candidate, index) =>
          `Candidate ${index + 1}: ${candidate.approvedAction}\n${candidate.description}`,
      ),
    ].join("\n");
    setLifecycleAiDraftExcerpt("commitment", excerpt);
  }, [title, summary, candidates]);

  useEffect(() => {
    const contract = getLifecycleAiStageApplyContract("commitment");
    if (!contract) {
      return;
    }

    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "commitment") {
        return;
      }

      const result = applyLifecycleAiSuggestionsToCandidateCollection({
        packageFields: { title, summary },
        candidates,
        suggestions: detail.suggestions,
        packageKeys: ["title", "summary"],
        candidateKeys: [
          "description",
          "suggestedResponsibleRole",
          "suggestedTimeline",
          "priority",
          "requiredResources",
          "relatedRisks",
          "references",
        ],
        forbiddenKeys: contract!.forbiddenKeys,
        fallbackKey: "summary",
      });

      if (!result.applied) {
        return;
      }

      setTitle(result.packageFields.title);
      setSummary(result.packageFields.summary);
      setCandidates(result.candidates);
      setApplyNotice(
        "AI suggestion applied locally. Edit as needed, then Save Draft. Nothing was published.",
      );
      setError(null);
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [initiativeId, title, summary, candidates]);

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
    setApplyNotice(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeImplementationCommitmentDraft(initiativeId),
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
        saveInitiativeImplementationCommitmentDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeImplementationCommitmentDraft(initiativeId, buildSavePayload());
      const pkg = await publishPhase.runSave(() =>
        publishInitiativeImplementationCommitmentStage(initiativeId),
      );
      setPublished(true);
      onPublished(pkg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="iic-editor">
      <div className="iic-editor__field">
        <label htmlFor="iic-title">Title</label>
        <input id="iic-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="iic-editor__field">
        <label htmlFor="iic-summary">Summary</label>
        <textarea
          id="iic-summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>

      {candidates.length === 0 ? (
        <p className="iic-source-panel__empty">
          No Commitment Candidates yet. Generate a draft from the published Collective Decision&rsquo;s
          Approved Actions.
        </p>
      ) : (
        candidates.map((candidate, index) => (
          <div className="iic-candidate" key={candidate.candidateId}>
            <div className="iic-candidate__header">
              <h4 className="iic-candidate__title">
                Action {index + 1}: {candidate.approvedAction}
              </h4>
              <span className="iic-candidate__status">draft</span>
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-description-${candidate.candidateId}`}>Description</label>
              <textarea
                id={`iic-description-${candidate.candidateId}`}
                rows={2}
                value={candidate.description}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { description: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-role-${candidate.candidateId}`}>Suggested Responsible Role</label>
              <input
                id={`iic-role-${candidate.candidateId}`}
                value={candidate.suggestedResponsibleRole}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { suggestedResponsibleRole: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-timeline-${candidate.candidateId}`}>Suggested Timeline</label>
              <input
                id={`iic-timeline-${candidate.candidateId}`}
                value={candidate.suggestedTimeline}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { suggestedTimeline: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-priority-${candidate.candidateId}`}>Priority</label>
              <input
                id={`iic-priority-${candidate.candidateId}`}
                value={candidate.priority}
                onChange={(event) => updateCandidate(candidate.candidateId, { priority: event.target.value })}
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-resources-${candidate.candidateId}`}>Required Resources (one per line)</label>
              <textarea
                id={`iic-resources-${candidate.candidateId}`}
                rows={2}
                value={candidate.requiredResources}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { requiredResources: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-risks-${candidate.candidateId}`}>Related Risks (one per line)</label>
              <textarea
                id={`iic-risks-${candidate.candidateId}`}
                rows={2}
                value={candidate.relatedRisks}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { relatedRisks: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-references-${candidate.candidateId}`}>References (one per line)</label>
              <textarea
                id={`iic-references-${candidate.candidateId}`}
                rows={2}
                value={candidate.references}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { references: event.target.value })
                }
              />
            </div>
            <div className="iic-editor__field">
              <label htmlFor={`iic-participant-${candidate.candidateId}`}>
                Proposed Participant ID (optional)
              </label>
              <input
                id={`iic-participant-${candidate.candidateId}`}
                value={candidate.proposedParticipantId}
                placeholder="Leave empty to publish unassigned"
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { proposedParticipantId: event.target.value })
                }
              />
            </div>
          </div>
        ))
      )}

      {error ? <p className="iic-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="iic-source-panel__empty">{applyNotice}</p> : null}

      <div className="iic-editor__actions">
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
            onClick={() => onNavigate("tracking", "implementation-tracking")}
          >
            Open Implementation Tracking
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
