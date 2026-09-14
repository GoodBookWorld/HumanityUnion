"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";

import type { InitiativeCollectiveDecision, InitiativeCollectiveDecisionLifecycleDraft, ParticipationScope } from "@hu/types";

import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import {
  formatLifecycleAiApplyNotice,
  resolveParticipationScopeDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
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

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
  const actions = useAuthorActionLabels();
  const { t } = actions;
  const locale = useLocale();
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
    onAppliedNotice: ({ changedKeys }) => {
      setApplyNotice(
        formatLifecycleAiApplyNotice({
          locale,
          stageId: "collective_decision",
          changedKeys,
          t,
          saveDraft: actions.saveDraft,
          preview: actions.preview,
          publish: actions.publish,
        }),
      );
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
      setError(
        t("author.collectiveDecision.messages.generateFailed", {
          detail: detailFromError(err, t("author.collectiveDecision.messages.unknownError")),
        }),
      );
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
      setError(
        t("author.collectiveDecision.messages.saveFailed", {
          detail: detailFromError(err, t("author.collectiveDecision.messages.unknownError")),
        }),
      );
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
      setError(
        t("author.collectiveDecision.messages.publishFailed", {
          detail: detailFromError(err, t("author.collectiveDecision.messages.unknownError")),
        }),
      );
    }
  }

  return (
    <div className="icd-editor">
      <div className="icd-editor__field">
        <label htmlFor="icd-title">{t("author.collectiveDecision.fields.title")}</label>
        <input id="icd-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-summary">{t("author.collectiveDecision.fields.summary")}</label>
        <textarea
          id="icd-summary"
          rows={3}
          value={decisionSummary}
          onChange={(event) => setDecisionSummary(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-approved">{t("author.collectiveDecision.fields.approvedActions")}</label>
        <textarea
          id="icd-approved"
          rows={4}
          value={approvedActions}
          onChange={(event) => setApprovedActions(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-rejected">{t("author.collectiveDecision.fields.rejectedAlternatives")}</label>
        <textarea
          id="icd-rejected"
          rows={3}
          value={rejectedAlternatives}
          onChange={(event) => setRejectedAlternatives(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-roles">{t("author.collectiveDecision.fields.roles")}</label>
        <textarea
          id="icd-roles"
          rows={3}
          value={responsibleRoles}
          onChange={(event) => setResponsibleRoles(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-priorities">{t("author.collectiveDecision.fields.priorities")}</label>
        <textarea
          id="icd-priorities"
          rows={3}
          value={implementationPriorities}
          onChange={(event) => setImplementationPriorities(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-timeline">{t("author.collectiveDecision.fields.timeline")}</label>
        <textarea
          id="icd-timeline"
          rows={3}
          value={implementationTimeline}
          onChange={(event) => setImplementationTimeline(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-rationale">{t("author.collectiveDecision.fields.rationale")}</label>
        <textarea
          id="icd-rationale"
          rows={4}
          value={decisionRationale}
          onChange={(event) => setDecisionRationale(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-risks">{t("author.collectiveDecision.fields.risks")}</label>
        <textarea
          id="icd-risks"
          rows={3}
          value={decisionRisks}
          onChange={(event) => setDecisionRisks(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-success">{t("author.collectiveDecision.fields.criteria")}</label>
        <textarea
          id="icd-success"
          rows={3}
          value={successCriteria}
          onChange={(event) => setSuccessCriteria(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-resources">{t("author.collectiveDecision.fields.requiredResources")}</label>
        <textarea
          id="icd-resources"
          rows={3}
          value={requiredResources}
          onChange={(event) => setRequiredResources(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-references">{t("author.collectiveDecision.fields.supportingReferences")}</label>
        <textarea
          id="icd-references"
          rows={3}
          value={supportingReferences}
          onChange={(event) => setSupportingReferences(event.target.value)}
        />
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-scope">{t("author.collectiveDecision.fields.participationScope")}</label>
        <select
          id="icd-scope"
          value={participationScope}
          onChange={(event) => setParticipationScope(event.target.value as ParticipationScope)}
        >
          {PARTICIPATION_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {resolveParticipationScopeDisplayLabel(scope, t)}
            </option>
          ))}
        </select>
      </div>
      <div className="icd-editor__field">
        <label htmlFor="icd-closes">{t("author.collectiveDecision.fields.closingDate")}</label>
        <input
          id="icd-closes"
          type="datetime-local"
          value={toDatetimeLocalValue(closesAt)}
          onChange={(event) => setClosesAt(fromDatetimeLocalValue(event.target.value))}
        />
      </div>

      {error ? <p className="icd-source-panel__empty">{error}</p> : null}
      {applyNotice ? (
        <p className="icd-source-panel__empty" role="status">
          {applyNotice}
        </p>
      ) : null}

      <div className="icd-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {actions.saveLabel(
            generatePhase.phase,
            t("author.collectiveDecision.generateCollectiveDecisionDraft"),
          )}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {actions.saveLabel(publishPhase.phase, actions.publish)}
        </WorkspaceButton>
        {published && onNavigate ? (
          <WorkspaceButton
            variant="secondary"
            onClick={() => onNavigate("commitment", "implementation-commitments")}
          >
            {t("author.collectiveDecision.openImplementationCommitments")}
          </WorkspaceButton>
        ) : null}
      </div>
    </div>
  );
}
