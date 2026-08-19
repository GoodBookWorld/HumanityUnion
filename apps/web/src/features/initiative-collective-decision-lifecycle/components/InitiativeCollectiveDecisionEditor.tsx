"use client";

import { useMemo, useState } from "react";

import type { InitiativeCollectiveDecision, InitiativeCollectiveDecisionLifecycleDraft, ParticipationScope } from "@hu/types";

import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeCollectiveDecisionDraft,
  publishInitiativeCollectiveDecisionStage,
  saveInitiativeCollectiveDecisionDraft,
} from "../api";

const PARTICIPATION_SCOPES: readonly ParticipationScope[] = ["world", "country", "region", "community"];

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: readonly string[]): string {
  return values.join("\n");
}

function toDatetimeLocalValue(iso: string): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

interface CollectiveDecisionApplyForm {
  title: string;
  decisionSummary: string;
  approvedActions: string;
  rejectedAlternatives: string;
  responsibleRoles: string;
  implementationPriorities: string;
  implementationTimeline: string;
  decisionRationale: string;
  decisionRisks: string;
  successCriteria: string;
  requiredResources: string;
  supportingReferences: string;
}

interface InitiativeCollectiveDecisionEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeCollectiveDecisionLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeCollectiveDecisionLifecycleDraft) => void;
  readonly onPublished: (decision: InitiativeCollectiveDecision) => void;
  readonly onTogglePreview: () => void;
  /** Threaded from the shared Lifecycle shell so Publish can offer "Open Implementation Commitments" navigation. */
  readonly onNavigate?: (stageId: string, hash: string) => void;
}

export function InitiativeCollectiveDecisionEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
  onNavigate,
}: InitiativeCollectiveDecisionEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [decisionSummary, setDecisionSummary] = useState(draft.decisionSummary);
  const [approvedActions, setApprovedActions] = useState(listToLines(draft.approvedActions));
  const [rejectedAlternatives, setRejectedAlternatives] = useState(listToLines(draft.rejectedAlternatives));
  const [responsibleRoles, setResponsibleRoles] = useState(listToLines(draft.responsibleRoles));
  const [implementationPriorities, setImplementationPriorities] = useState(
    listToLines(draft.implementationPriorities),
  );
  const [implementationTimeline, setImplementationTimeline] = useState(draft.implementationTimeline);
  const [decisionRationale, setDecisionRationale] = useState(draft.decisionRationale);
  const [decisionRisks, setDecisionRisks] = useState(listToLines(draft.decisionRisks));
  const [successCriteria, setSuccessCriteria] = useState(listToLines(draft.successCriteria));
  const [requiredResources, setRequiredResources] = useState(listToLines(draft.requiredResources));
  const [supportingReferences, setSupportingReferences] = useState(listToLines(draft.supportingReferences));
  const [participationScope, setParticipationScope] = useState<ParticipationScope>(draft.participationScope);
  const [closesAt, setClosesAt] = useState(draft.closesAt);
  const [error, setError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  const applyForm = useMemo<CollectiveDecisionApplyForm>(
    () => ({
      title,
      decisionSummary,
      approvedActions,
      rejectedAlternatives,
      responsibleRoles,
      implementationPriorities,
      implementationTimeline,
      decisionRationale,
      decisionRisks,
      successCriteria,
      requiredResources,
      supportingReferences,
    }),
    [
      title,
      decisionSummary,
      approvedActions,
      rejectedAlternatives,
      responsibleRoles,
      implementationPriorities,
      implementationTimeline,
      decisionRationale,
      decisionRisks,
      successCriteria,
      requiredResources,
      supportingReferences,
    ],
  );

  useLifecycleAiFormApply({
    initiativeId,
    stageId: "collective_decision",
    form: applyForm,
    onFormApplied: (next) => {
      setTitle(next.title);
      setDecisionSummary(next.decisionSummary);
      setApprovedActions(next.approvedActions);
      setRejectedAlternatives(next.rejectedAlternatives);
      setResponsibleRoles(next.responsibleRoles);
      setImplementationPriorities(next.implementationPriorities);
      setImplementationTimeline(next.implementationTimeline);
      setDecisionRationale(next.decisionRationale);
      setDecisionRisks(next.decisionRisks);
      setSuccessCriteria(next.successCriteria);
      setRequiredResources(next.requiredResources);
      setSupportingReferences(next.supportingReferences);
    },
    onAppliedNotice: (text) => {
      setApplyNotice(text);
      setError(null);
    },
  });

  function buildSavePayload() {
    return {
      title,
      decisionSummary,
      approvedActions: linesToList(approvedActions),
      rejectedAlternatives: linesToList(rejectedAlternatives),
      responsibleRoles: linesToList(responsibleRoles),
      implementationPriorities: linesToList(implementationPriorities),
      implementationTimeline,
      decisionRationale,
      decisionRisks: linesToList(decisionRisks),
      successCriteria: linesToList(successCriteria),
      requiredResources: linesToList(requiredResources),
      supportingReferences: linesToList(supportingReferences),
      participationScope,
      closesAt,
    };
  }

  async function handleGenerate() {
    setError(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeCollectiveDecisionDraft(initiativeId),
      );
      setTitle(generated.title);
      setDecisionSummary(generated.decisionSummary);
      setApprovedActions(listToLines(generated.approvedActions));
      setRejectedAlternatives(listToLines(generated.rejectedAlternatives));
      setResponsibleRoles(listToLines(generated.responsibleRoles));
      setImplementationPriorities(listToLines(generated.implementationPriorities));
      setImplementationTimeline(generated.implementationTimeline);
      setDecisionRationale(generated.decisionRationale);
      setDecisionRisks(listToLines(generated.decisionRisks));
      setSuccessCriteria(listToLines(generated.successCriteria));
      setRequiredResources(listToLines(generated.requiredResources));
      setSupportingReferences(listToLines(generated.supportingReferences));
      onDraftUpdated(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativeCollectiveDecisionDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeCollectiveDecisionDraft(initiativeId, buildSavePayload());
      const decision = await publishPhase.runSave(() =>
        publishInitiativeCollectiveDecisionStage(initiativeId),
      );
      setPublished(true);
      onPublished(decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="icd-editor">
      <div className="icd-editor__field">
        <label htmlFor="icd-title">Decision Title</label>
        <input id="icd-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-summary">Decision Summary</label>
        <textarea
          id="icd-summary"
          rows={3}
          value={decisionSummary}
          onChange={(event) => setDecisionSummary(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-approved">Approved Actions (one per line)</label>
        <textarea
          id="icd-approved"
          rows={4}
          value={approvedActions}
          onChange={(event) => setApprovedActions(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-rejected">Rejected Alternatives (one per line)</label>
        <textarea
          id="icd-rejected"
          rows={3}
          value={rejectedAlternatives}
          onChange={(event) => setRejectedAlternatives(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-roles">Responsible Roles (one per line)</label>
        <textarea
          id="icd-roles"
          rows={3}
          value={responsibleRoles}
          onChange={(event) => setResponsibleRoles(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-priorities">Implementation Priorities (one per line)</label>
        <textarea
          id="icd-priorities"
          rows={3}
          value={implementationPriorities}
          onChange={(event) => setImplementationPriorities(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-timeline">Implementation Timeline</label>
        <textarea
          id="icd-timeline"
          rows={3}
          value={implementationTimeline}
          onChange={(event) => setImplementationTimeline(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-rationale">Decision Rationale</label>
        <textarea
          id="icd-rationale"
          rows={4}
          value={decisionRationale}
          onChange={(event) => setDecisionRationale(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-risks">Decision Risks (one per line)</label>
        <textarea
          id="icd-risks"
          rows={3}
          value={decisionRisks}
          onChange={(event) => setDecisionRisks(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-success">Success Criteria (one per line)</label>
        <textarea
          id="icd-success"
          rows={3}
          value={successCriteria}
          onChange={(event) => setSuccessCriteria(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-resources">Required Resources (one per line)</label>
        <textarea
          id="icd-resources"
          rows={3}
          value={requiredResources}
          onChange={(event) => setRequiredResources(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-references">Supporting References (one per line)</label>
        <textarea
          id="icd-references"
          rows={3}
          value={supportingReferences}
          onChange={(event) => setSupportingReferences(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-scope">Participation Scope</label>
        <select
          id="icd-scope"
          value={participationScope}
          onChange={(event) => setParticipationScope(event.target.value as ParticipationScope)}
        >
          {PARTICIPATION_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {scope}
            </option>
          ))}
        </select>
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-closes">Closing Date</label>
        <input
          id="icd-closes"
          type="datetime-local"
          value={toDatetimeLocalValue(closesAt)}
          onChange={(event) => setClosesAt(fromDatetimeLocalValue(event.target.value))}
        />
      </div>

      {error ? <p className="icd-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="icd-source-panel__empty">{applyNotice}</p> : null}

      <div className="icd-editor__actions">
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
            onClick={() => onNavigate("commitment", "implementation-commitments")}
          >
            Open Implementation Commitments
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
