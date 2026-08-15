"use client";

import { useState } from "react";

import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponsePackage,
  OfficialResponseType,
  OfficialResponseVerificationState,
} from "@hu/types";

import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeOfficialResponseDraft,
  publishInitiativeOfficialResponseStage,
  saveInitiativeOfficialResponseDraft,
} from "../api";

const RESPONSE_TYPE_OPTIONS: readonly OfficialResponseType[] = [
  "official_letter",
  "email",
  "public_statement",
  "meeting_minutes",
  "policy_update",
  "decision_notice",
  "media_response",
  "other",
];

const VERIFICATION_STATUS_OPTIONS: readonly OfficialResponseVerificationState[] = [
  "pending",
  "verified",
  "unable_to_verify",
];

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
  institution: string;
  organization: string;
  responseType: OfficialResponseType;
  subject: string;
  receivedAt: string;
  summary: string;
  referenceNumber: string;
  relatedActions: string;
  relatedCommitmentIds: string;
  relatedTrackingIds: string;
  documentIds: string;
  links: string;
  verificationStatus: OfficialResponseVerificationState;
  notes: string;
  references: string;
}

function toFormState(candidate: InitiativeOfficialResponseCandidate): CandidateFormState {
  return {
    candidateId: candidate.candidateId,
    institution: candidate.institution,
    organization: candidate.organization,
    responseType: candidate.responseType,
    subject: candidate.subject,
    receivedAt: candidate.receivedAt,
    summary: candidate.summary,
    referenceNumber: candidate.referenceNumber,
    relatedActions: listToLines(candidate.relatedActions),
    relatedCommitmentIds: listToLines(candidate.relatedCommitmentIds),
    relatedTrackingIds: listToLines(candidate.relatedTrackingIds),
    documentIds: listToLines(candidate.documentIds),
    links: listToLines(candidate.links),
    verificationStatus: candidate.verificationStatus,
    notes: candidate.notes,
    references: listToLines(candidate.references),
  };
}

function fromFormState(state: CandidateFormState): InitiativeOfficialResponseCandidate {
  return {
    candidateId: state.candidateId,
    institution: state.institution,
    organization: state.organization,
    responseType: state.responseType,
    subject: state.subject,
    receivedAt: state.receivedAt,
    summary: state.summary,
    referenceNumber: state.referenceNumber,
    relatedActions: linesToList(state.relatedActions),
    relatedCommitmentIds: linesToList(state.relatedCommitmentIds),
    relatedTrackingIds: linesToList(state.relatedTrackingIds),
    documentIds: linesToList(state.documentIds),
    links: linesToList(state.links),
    verificationStatus: state.verificationStatus,
    notes: state.notes,
    references: linesToList(state.references),
  };
}

interface InitiativeOfficialResponseEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeOfficialResponseLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeOfficialResponseLifecycleDraft) => void;
  readonly onPublished: (pkg: InitiativeOfficialResponsePackage) => void;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Public Impact" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeOfficialResponseEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  onNavigate,
}: InitiativeOfficialResponseEditorProps) {
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
        generateInitiativeOfficialResponseDraft(initiativeId),
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
        saveInitiativeOfficialResponseDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeOfficialResponseDraft(initiativeId, buildSavePayload());
      const pkg = await publishPhase.runSave(() => publishInitiativeOfficialResponseStage(initiativeId));
      setPublished(true);
      onPublished(pkg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="ior-editor">
      <div className="ior-editor__field">
        <label htmlFor="ior-title">Title</label>
        <input id="ior-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="ior-editor__field">
        <label htmlFor="ior-summary">Summary</label>
        <textarea
          id="ior-summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>

      {candidates.length === 0 ? (
        <p className="ior-source-panel__empty">
          No Response Candidates yet. Generate a draft from the published Implementation Tracking Records.
        </p>
      ) : (
        candidates.map((candidate, index) => (
          <div className="ior-candidate" key={candidate.candidateId}>
            <div className="ior-candidate__header">
              <h4 className="ior-candidate__title">
                Candidate {index + 1}: {candidate.subject || "Untitled"}
              </h4>
              <span className="ior-candidate__status">{candidate.verificationStatus}</span>
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-institution-${candidate.candidateId}`}>Institution</label>
              <input
                id={`ior-institution-${candidate.candidateId}`}
                value={candidate.institution}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { institution: event.target.value })
                }
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-organization-${candidate.candidateId}`}>Organization</label>
              <input
                id={`ior-organization-${candidate.candidateId}`}
                value={candidate.organization}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { organization: event.target.value })
                }
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-response-type-${candidate.candidateId}`}>Response Type</label>
              <select
                id={`ior-response-type-${candidate.candidateId}`}
                value={candidate.responseType}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, {
                    responseType: event.target.value as OfficialResponseType,
                  })
                }
              >
                {RESPONSE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-subject-${candidate.candidateId}`}>Subject</label>
              <input
                id={`ior-subject-${candidate.candidateId}`}
                value={candidate.subject}
                onChange={(event) => updateCandidate(candidate.candidateId, { subject: event.target.value })}
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-received-${candidate.candidateId}`}>Received Date</label>
              <input
                id={`ior-received-${candidate.candidateId}`}
                type="date"
                value={candidate.receivedAt}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { receivedAt: event.target.value })
                }
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-summary-${candidate.candidateId}`}>Summary</label>
              <textarea
                id={`ior-summary-${candidate.candidateId}`}
                rows={2}
                value={candidate.summary}
                onChange={(event) => updateCandidate(candidate.candidateId, { summary: event.target.value })}
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-reference-number-${candidate.candidateId}`}>Reference Number</label>
              <input
                id={`ior-reference-number-${candidate.candidateId}`}
                value={candidate.referenceNumber}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { referenceNumber: event.target.value })
                }
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-document-ids-${candidate.candidateId}`}>Document IDs (one per line)</label>
              <textarea
                id={`ior-document-ids-${candidate.candidateId}`}
                rows={2}
                value={candidate.documentIds}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { documentIds: event.target.value })
                }
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-links-${candidate.candidateId}`}>Links (one per line)</label>
              <textarea
                id={`ior-links-${candidate.candidateId}`}
                rows={2}
                value={candidate.links}
                onChange={(event) => updateCandidate(candidate.candidateId, { links: event.target.value })}
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-verification-${candidate.candidateId}`}>Verification Status</label>
              <select
                id={`ior-verification-${candidate.candidateId}`}
                value={candidate.verificationStatus}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, {
                    verificationStatus: event.target.value as OfficialResponseVerificationState,
                  })
                }
              >
                {VERIFICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-notes-${candidate.candidateId}`}>Notes</label>
              <textarea
                id={`ior-notes-${candidate.candidateId}`}
                rows={2}
                value={candidate.notes}
                onChange={(event) => updateCandidate(candidate.candidateId, { notes: event.target.value })}
              />
            </div>
          </div>
        ))
      )}

      {error ? <p className="ior-source-panel__empty">{error}</p> : null}

      <div className="ior-editor__actions">
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
            onClick={() => onNavigate("public_impact", "public-impact")}
          >
            Open Public Impact
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
