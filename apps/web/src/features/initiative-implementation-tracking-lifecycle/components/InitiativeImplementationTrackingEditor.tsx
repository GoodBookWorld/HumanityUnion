"use client";

import { useEffect, useState } from "react";

import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingPackage,
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

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

interface CandidateFormState {
  candidateId: string;
  commitmentId: string;
  title: string;
  description: string;
  approvedAction: string;
  responsibleParticipantId: string;
  currentStatus: string;
  progress: string;
  plannedStartDate: string;
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
    title: candidate.title || candidate.approvedAction,
    description: candidate.description || "",
    approvedAction: candidate.approvedAction || candidate.title,
    responsibleParticipantId: candidate.responsibleParticipantId,
    currentStatus: candidate.currentStatus,
    progress: String(candidate.progress),
    plannedStartDate: candidate.plannedStartDate ?? "",
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
  const title = state.title.trim() || state.approvedAction.trim();

  return {
    candidateId: state.candidateId,
    commitmentId: state.commitmentId,
    title,
    description: state.description,
    approvedAction: state.approvedAction.trim() || title,
    responsibleParticipantId: state.responsibleParticipantId.trim(),
    currentStatus: state.currentStatus,
    progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0,
    plannedStartDate: state.plannedStartDate.trim() || null,
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
  const actions = useAuthorActionLabels();
  const { t } = actions;
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
          `Milestone ${index + 1}: ${candidate.title || candidate.approvedAction}\n${candidate.description}`,
      ),
    ].join("\n");
    setLifecycleAiDraftExcerpt("tracking", excerpt);
  }, [title, summary, candidates]);

  useEffect(() => {
    const contract = getLifecycleAiStageApplyContract("tracking");
    if (!contract) {
      return;
    }

    function handleApplySuggestions(event: Event) {
      const custom = event as CustomEvent<LifecycleAiApplySuggestionsDetail>;
      const detail = custom.detail;

      if (!detail || detail.initiativeId !== initiativeId || detail.stageId !== "tracking") {
        return;
      }

      const result = applyLifecycleAiSuggestionsToCandidateCollection({
        packageFields: { title, summary },
        candidates,
        suggestions: detail.suggestions,
        packageKeys: ["title", "summary"],
        candidateKeys: [
          "title",
          "description",
          "currentStatus",
          "progress",
          "plannedStartDate",
          "targetDate",
          "dependencies",
          "obstacles",
          "evidenceReferences",
          "notes",
        ],
        candidateKeyAliases: { milestoneTitle: "title" },
        forbiddenKeys: contract!.forbiddenKeys,
        fallbackKey: "summary",
      });

      if (!result.applied) {
        return;
      }

      setTitle(result.packageFields.title);
      setSummary(result.packageFields.summary);
      setCandidates(result.candidates);
      setApplyNotice(t("author.tracking.messages.aiApplied"));
      setError(null);
    }

    window.addEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    return () => {
      window.removeEventListener(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, handleApplySuggestions);
    };
  }, [initiativeId, title, summary, candidates, t]);

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
        generateInitiativeImplementationTrackingDraft(initiativeId),
      );
      setTitle(generated.title);
      setSummary(generated.summary);
      setCandidates(generated.candidates.map((candidate) => toFormState(candidate)));
      onDraftUpdated(generated);
    } catch (err) {
      setError(
        t("author.tracking.messages.generateFailed", {
          detail: detailFromError(err, t("author.tracking.messages.unknownError")),
        }),
      );
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
      setError(
        t("author.tracking.messages.saveFailed", {
          detail: detailFromError(err, t("author.tracking.messages.unknownError")),
        }),
      );
    }
  }

  async function handlePublish() {
    if (!window.confirm(t("author.tracking.publishConfirm"))) {
      return;
    }

    setError(null);
    try {
      await saveInitiativeImplementationTrackingDraft(initiativeId, buildSavePayload());
      const pkg = await publishPhase.runSave(() =>
        publishInitiativeImplementationTrackingStage(initiativeId),
      );
      setPublished(true);
      onPublished(pkg);
      onNavigate?.("official_response", "official-responses");
    } catch (err) {
      setError(
        t("author.tracking.messages.publishFailed", {
          detail: detailFromError(err, t("author.tracking.messages.unknownError")),
        }),
      );
    }
  }

  return (
    <div className="iit-editor">
      <div className="iit-editor__field">
        <label htmlFor="iit-title">{t("author.tracking.fields.title")}</label>
        <input id="iit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="iit-editor__field">
        <label htmlFor="iit-summary">{t("author.tracking.fields.summary")}</label>
        <textarea
          id="iit-summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </div>

      {candidates.length === 0 ? (
        <p className="iit-source-panel__empty">{t("author.tracking.noMilestonesYet")}</p>
      ) : (
        candidates.map((candidate, index) => (
          <div className="iit-candidate" key={candidate.candidateId}>
            <div className="iit-candidate__header">
              <h4 className="iit-candidate__title">
                {t("author.tracking.milestoneHeading", {
                  number: index + 1,
                  title:
                    candidate.title ||
                    candidate.approvedAction ||
                    t("author.tracking.untitledMilestone"),
                })}
              </h4>
              <span className="iit-candidate__status">{candidate.currentStatus}</span>
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-milestone-title-${candidate.candidateId}`}>
                {t("author.tracking.fields.title")}
              </label>
              <input
                id={`iit-milestone-title-${candidate.candidateId}`}
                value={candidate.title}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, {
                    title: event.target.value,
                    approvedAction: event.target.value,
                  })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-description-${candidate.candidateId}`}>
                {t("author.tracking.fields.description")}
              </label>
              <textarea
                id={`iit-description-${candidate.candidateId}`}
                rows={2}
                value={candidate.description}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { description: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-status-${candidate.candidateId}`}>
                {t("author.tracking.fields.status")}
              </label>
              <input
                id={`iit-status-${candidate.candidateId}`}
                value={candidate.currentStatus}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { currentStatus: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-progress-${candidate.candidateId}`}>
                {t("author.tracking.fields.progress")}
              </label>
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
              <label htmlFor={`iit-responsible-${candidate.candidateId}`}>
                {t("author.tracking.fields.responsible")}
              </label>
              <input
                id={`iit-responsible-${candidate.candidateId}`}
                value={candidate.responsibleParticipantId}
                placeholder={t("author.tracking.fields.responsiblePlaceholder")}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, {
                    responsibleParticipantId: event.target.value,
                  })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-planned-start-${candidate.candidateId}`}>
                {t("author.tracking.fields.plannedStart")}
              </label>
              <input
                id={`iit-planned-start-${candidate.candidateId}`}
                type="date"
                value={candidate.plannedStartDate}
                onChange={(event) =>
                  updateCandidate(candidate.candidateId, { plannedStartDate: event.target.value })
                }
              />
            </div>
            <div className="iit-editor__field">
              <label htmlFor={`iit-target-${candidate.candidateId}`}>
                {t("author.tracking.fields.plannedEnd")}
              </label>
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
              <label htmlFor={`iit-dependencies-${candidate.candidateId}`}>
                {t("author.tracking.fields.dependencies")}
              </label>
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
              <label htmlFor={`iit-obstacles-${candidate.candidateId}`}>
                {t("author.tracking.fields.obstacles")}
              </label>
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
              <label htmlFor={`iit-evidence-${candidate.candidateId}`}>
                {t("author.tracking.fields.evidence")}
              </label>
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
              <label htmlFor={`iit-notes-${candidate.candidateId}`}>
                {t("author.tracking.fields.notes")}
              </label>
              <textarea
                id={`iit-notes-${candidate.candidateId}`}
                rows={2}
                value={candidate.notes}
                onChange={(event) => updateCandidate(candidate.candidateId, { notes: event.target.value })}
              />
            </div>
            {candidate.commitmentId ? (
              <p className="iit-source-panel__empty">
                {t("author.tracking.sourceCommitment", { commitmentId: candidate.commitmentId })}
              </p>
            ) : (
              <p className="iit-source-panel__empty">{t("author.tracking.authorOriginated")}</p>
            )}
          </div>
        ))
      )}

      {error ? <p className="iit-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="iit-source-panel__empty">{applyNotice}</p> : null}

      <div className="iit-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, t("author.tracking.generateTrackingDraft"))}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(
            publishPhase.phase,
            t("author.tracking.publishAndContinue"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
        {published && onNavigate ? (
          <WorkspaceButton
            variant="secondary"
            onClick={() => onNavigate("official_response", "official-responses")}
          >
            {t("author.tracking.openOfficialResponses")}
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
