"use client";

import { useEffect, useState } from "react";

import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
  InitiativeOfficialResponsePackage,
  OfficialResponseType,
  OfficialResponseVerificationState,
} from "@hu/types";

import {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  applyLifecycleAiSuggestionsToCandidateCollection,
  getLifecycleAiStageApplyContract,
  setLifecycleAiDraftExcerpt,
  type LifecycleAiApplySuggestionsDetail,
} from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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

function emptyNoResponseDetail(): InitiativeOfficialResponseNoResponseDetail {
  return {
    contactedOrganizations: [],
    contactedDates: [],
    note: "",
  };
}

function createEmptyCandidate(index: number): CandidateFormState {
  return {
    candidateId: `official-response-candidate-${Date.now()}-${index}`,
    institution: "",
    organization: "",
    responseType: "other",
    subject: "",
    receivedAt: "",
    summary: "",
    referenceNumber: "",
    relatedActions: "",
    relatedCommitmentIds: "",
    relatedTrackingIds: "",
    documentIds: "",
    links: "",
    verificationStatus: "pending",
    notes: "",
    references: "",
  };
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
  const actions = useAuthorActionLabels();
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary);
  const [outcomeKind, setOutcomeKind] = useState<InitiativeOfficialResponseOutcomeKind>(
    draft.outcomeKind ?? "responses_received",
  );
  const [noResponseDetail, setNoResponseDetail] = useState<InitiativeOfficialResponseNoResponseDetail>(
    draft.noResponseDetail ?? emptyNoResponseDetail(),
  );
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
      outcomeKind === "no_official_response_received"
        ? `No response note: ${noResponseDetail.note}`
        : "",
      ...candidates.map(
        (candidate, index) =>
          `Response ${index + 1}: ${candidate.subject}\n${candidate.summary}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
    setLifecycleAiDraftExcerpt("official_response", excerpt);
  }, [title, summary, outcomeKind, noResponseDetail.note, candidates]);

  useEffect(() => {
    const contract = getLifecycleAiStageApplyContract("official_response");
    if (!contract) {
      return;
    }

    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "official_response") {
        return;
      }

      const packageFields = {
        title,
        summary,
        noResponseNote: noResponseDetail.note,
      };

      const result = applyLifecycleAiSuggestionsToCandidateCollection({
        packageFields,
        candidates,
        suggestions: detail.suggestions,
        packageKeys: ["title", "summary", "noResponseNote"],
        candidateKeys: ["institution", "organization", "subject", "summary", "notes", "links"],
        candidateKeyAliases: { responseSummary: "summary" },
        forbiddenKeys: contract!.forbiddenKeys,
        fallbackKey: "summary",
      });

      if (!result.applied) {
        return;
      }

      setTitle(result.packageFields.title);
      setSummary(result.packageFields.summary);
      if (result.packageFields.noResponseNote !== noResponseDetail.note) {
        setNoResponseDetail((current) => ({
          ...current,
          note: result.packageFields.noResponseNote,
        }));
      }
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
  }, [initiativeId, title, summary, noResponseDetail.note, candidates]);

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
      outcomeKind,
      noResponseDetail,
      candidates: outcomeKind === "no_official_response_received" ? [] : candidates.map(fromFormState),
    };
  }

  function handleMarkNoResponse() {
    setOutcomeKind("no_official_response_received");
    setCandidates([]);
    setError(null);
  }

  function handleMarkResponsesReceived() {
    setOutcomeKind("responses_received");
    if (candidates.length === 0) {
      setCandidates([createEmptyCandidate(0)]);
    }
    setError(null);
  }

  function handleAddResponse() {
    setOutcomeKind("responses_received");
    setCandidates((current) => [...current, createEmptyCandidate(current.length)]);
  }

  function handleRemoveResponse(candidateId: string) {
    setCandidates((current) => current.filter((candidate) => candidate.candidateId !== candidateId));
  }

  async function handleGenerate() {
    setError(null);
    setApplyNotice(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeOfficialResponseDraft(initiativeId),
      );
      setTitle(generated.title);
      setSummary(generated.summary);
      setOutcomeKind(generated.outcomeKind ?? "responses_received");
      setNoResponseDetail(generated.noResponseDetail ?? emptyNoResponseDetail());
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

  const isNoResponse = outcomeKind === "no_official_response_received";

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

      <div className="ior-editor__actions" style={{ marginBottom: "1rem" }}>
        <WorkspaceButton
          variant={isNoResponse ? "secondary" : "primary"}
          onClick={handleMarkResponsesReceived}
        >
          Received responses
        </WorkspaceButton>
        <WorkspaceButton variant={isNoResponse ? "primary" : "secondary"} onClick={handleMarkNoResponse}>
          No official response received
        </WorkspaceButton>
      </div>

      {isNoResponse ? (
        <section className="ior-candidate" aria-label="No official response received">
          <div className="ior-candidate__header">
            <h4 className="ior-candidate__title">No official response received</h4>
            <span className="ior-candidate__status">legitimate outcome</span>
          </div>
          <p className="ior-source-panel__empty">
            Document that no institution replied. This completes Official Responses without inventing
            response records, and unlocks Public Impact on Publish.
          </p>
          <div className="ior-editor__field">
            <label htmlFor="ior-contacted-orgs">Organizations / recipients contacted (optional, one per line)</label>
            <textarea
              id="ior-contacted-orgs"
              rows={2}
              value={listToLines(noResponseDetail.contactedOrganizations)}
              onChange={(event) =>
                setNoResponseDetail((current) => ({
                  ...current,
                  contactedOrganizations: linesToList(event.target.value),
                }))
              }
            />
          </div>
          <div className="ior-editor__field">
            <label htmlFor="ior-contacted-dates">Contact / follow-up dates (optional, one per line)</label>
            <textarea
              id="ior-contacted-dates"
              rows={2}
              value={listToLines(noResponseDetail.contactedDates)}
              onChange={(event) =>
                setNoResponseDetail((current) => ({
                  ...current,
                  contactedDates: linesToList(event.target.value),
                }))
              }
            />
          </div>
          <div className="ior-editor__field">
            <label htmlFor="ior-no-response-note">Explanatory note (optional)</label>
            <textarea
              id="ior-no-response-note"
              rows={3}
              value={noResponseDetail.note}
              onChange={(event) =>
                setNoResponseDetail((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </div>
        </section>
      ) : candidates.length === 0 ? (
        <div>
          <p className="ior-source-panel__empty">
            No received responses yet. Add a response with evidence, or record No official response
            received.
          </p>
          <WorkspaceButton variant="secondary" onClick={handleAddResponse}>
            Add received response
          </WorkspaceButton>
        </div>
      ) : (
        candidates.map((candidate, index) => (
          <div className="ior-candidate" key={candidate.candidateId}>
            <div className="ior-candidate__header">
              <h4 className="ior-candidate__title">
                Response {index + 1}: {candidate.subject || "Untitled"}
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
              <label htmlFor={`ior-summary-${candidate.candidateId}`}>Author description / summary</label>
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
              <label htmlFor={`ior-document-ids-${candidate.candidateId}`}>
                Document IDs (one per line — existing Secure Attachments)
              </label>
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
              <label htmlFor={`ior-links-${candidate.candidateId}`}>External URLs (one per line)</label>
              <textarea
                id={`ior-links-${candidate.candidateId}`}
                rows={2}
                value={candidate.links}
                onChange={(event) => updateCandidate(candidate.candidateId, { links: event.target.value })}
              />
            </div>
            <div className="ior-editor__field">
              <label htmlFor={`ior-verification-${candidate.candidateId}`}>Verification / evidence status</label>
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
            <div className="ior-editor__actions">
              <WorkspaceButton variant="secondary" onClick={() => handleRemoveResponse(candidate.candidateId)}>
                Remove response
              </WorkspaceButton>
            </div>
          </div>
        ))
      )}

      {!isNoResponse ? (
        <div className="ior-editor__actions" style={{ marginBottom: "1rem" }}>
          <WorkspaceButton variant="secondary" onClick={handleAddResponse}>
            Add received response
          </WorkspaceButton>
        </div>
      ) : null}

      {error ? <p className="ior-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="ior-source-panel__empty">{applyNotice}</p> : null}

      <div className="ior-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate / Open Draft", actions.phaseLabels)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(publishPhase.phase, "Publish & Continue to Public Impact", actions.phaseLabels)}
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
