"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";

import type { DecisionSession, InitiativeDecisionSessionDraft } from "@hu/types";

import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { formatLifecycleAiApplyNotice } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeDecisionSessionDraft,
  publishInitiativeDecisionSessionStage,
  saveInitiativeDecisionSessionDraft,
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

interface DecisionSessionApplyForm {
  title: string;
  decisionQuestion: string;
  decisionContext: string;
  objectives: string;
  options: string;
  supportingArguments: string;
  risks: string;
  dependencies: string;
  requiredResources: string;
  suggestedTimeline: string;
  suggestedParticipants: string;
  suggestedResponsibleRoles: string;
  unresolvedQuestions: string;
}

interface InitiativeDecisionSessionEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeDecisionSessionDraft;
  readonly onDraftUpdated: (draft: InitiativeDecisionSessionDraft) => void;
  readonly onPublished: (session: DecisionSession) => void;
  readonly onTogglePreview: () => void;
}

export function InitiativeDecisionSessionEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
}: InitiativeDecisionSessionEditorProps) {
  const actions = useAuthorActionLabels();
  const { t } = actions;
  const locale = useLocale();
  const [title, setTitle] = useState(draft.title);
  const [decisionQuestion, setDecisionQuestion] = useState(draft.decisionQuestion);
  const [decisionContext, setDecisionContext] = useState(draft.decisionContext);
  const [objectives, setObjectives] = useState(listToLines(draft.objectives));
  const [options, setOptions] = useState(listToLines(draft.options));
  const [supportingArguments, setSupportingArguments] = useState(
    listToLines(draft.supportingArguments),
  );
  const [risks, setRisks] = useState(listToLines(draft.risks));
  const [dependencies, setDependencies] = useState(listToLines(draft.dependencies));
  const [requiredResources, setRequiredResources] = useState(listToLines(draft.requiredResources));
  const [suggestedTimeline, setSuggestedTimeline] = useState(draft.suggestedTimeline);
  const [suggestedParticipants, setSuggestedParticipants] = useState(
    listToLines(draft.suggestedParticipants),
  );
  const [suggestedResponsibleRoles, setSuggestedResponsibleRoles] = useState(
    listToLines(draft.suggestedResponsibleRoles),
  );
  const [unresolvedQuestions, setUnresolvedQuestions] = useState(
    listToLines(draft.unresolvedQuestions),
  );
  const [error, setError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  const applyForm = useMemo<DecisionSessionApplyForm>(
    () => ({
      title,
      decisionQuestion,
      decisionContext,
      objectives,
      options,
      supportingArguments,
      risks,
      dependencies,
      requiredResources,
      suggestedTimeline,
      suggestedParticipants,
      suggestedResponsibleRoles,
      unresolvedQuestions,
    }),
    [
      title,
      decisionQuestion,
      decisionContext,
      objectives,
      options,
      supportingArguments,
      risks,
      dependencies,
      requiredResources,
      suggestedTimeline,
      suggestedParticipants,
      suggestedResponsibleRoles,
      unresolvedQuestions,
    ],
  );

  useLifecycleAiFormApply({
    initiativeId,
    stageId: "decision_session",
    form: applyForm,
    onFormApplied: (next) => {
      setTitle(next.title);
      setDecisionQuestion(next.decisionQuestion);
      setDecisionContext(next.decisionContext);
      setObjectives(next.objectives);
      setOptions(next.options);
      setSupportingArguments(next.supportingArguments);
      setRisks(next.risks);
      setDependencies(next.dependencies);
      setRequiredResources(next.requiredResources);
      setSuggestedTimeline(next.suggestedTimeline);
      setSuggestedParticipants(next.suggestedParticipants);
      setSuggestedResponsibleRoles(next.suggestedResponsibleRoles);
      setUnresolvedQuestions(next.unresolvedQuestions);
    },
    onAppliedNotice: ({ changedKeys }) => {
      setApplyNotice(
        formatLifecycleAiApplyNotice({
          locale,
          stageId: "decision_session",
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

  async function handleGenerate() {
    setError(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeDecisionSessionDraft(initiativeId),
      );
      setTitle(generated.title);
      setDecisionQuestion(generated.decisionQuestion);
      setDecisionContext(generated.decisionContext);
      setObjectives(listToLines(generated.objectives));
      setOptions(listToLines(generated.options));
      setSupportingArguments(listToLines(generated.supportingArguments));
      setRisks(listToLines(generated.risks));
      setDependencies(listToLines(generated.dependencies));
      setRequiredResources(listToLines(generated.requiredResources));
      setSuggestedTimeline(generated.suggestedTimeline);
      setSuggestedParticipants(listToLines(generated.suggestedParticipants));
      setSuggestedResponsibleRoles(listToLines(generated.suggestedResponsibleRoles));
      setUnresolvedQuestions(listToLines(generated.unresolvedQuestions));
      onDraftUpdated(generated);
    } catch (err) {
      setError(
        t("author.decisionSession.messages.generateFailed", {
          detail: detailFromError(err, t("author.decisionSession.messages.unknownError")),
        }),
      );
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativeDecisionSessionDraft(initiativeId, {
          title,
          decisionQuestion,
          decisionContext,
          objectives: linesToList(objectives),
          options: linesToList(options),
          supportingArguments: linesToList(supportingArguments),
          risks: linesToList(risks),
          dependencies: linesToList(dependencies),
          requiredResources: linesToList(requiredResources),
          suggestedTimeline,
          suggestedParticipants: linesToList(suggestedParticipants),
          suggestedResponsibleRoles: linesToList(suggestedResponsibleRoles),
          unresolvedQuestions: linesToList(unresolvedQuestions),
        }),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(
        t("author.decisionSession.messages.saveFailed", {
          detail: detailFromError(err, t("author.decisionSession.messages.unknownError")),
        }),
      );
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeDecisionSessionDraft(initiativeId, {
        title,
        decisionQuestion,
        decisionContext,
        objectives: linesToList(objectives),
        options: linesToList(options),
        supportingArguments: linesToList(supportingArguments),
        risks: linesToList(risks),
        dependencies: linesToList(dependencies),
        requiredResources: linesToList(requiredResources),
        suggestedTimeline,
        suggestedParticipants: linesToList(suggestedParticipants),
        suggestedResponsibleRoles: linesToList(suggestedResponsibleRoles),
        unresolvedQuestions: linesToList(unresolvedQuestions),
      });
      const published = await publishPhase.runSave(() =>
        publishInitiativeDecisionSessionStage(initiativeId),
      );
      onPublished(published);
    } catch (err) {
      setError(
        t("author.decisionSession.messages.publishFailed", {
          detail: detailFromError(err, t("author.decisionSession.messages.unknownError")),
        }),
      );
    }
  }

  return (
    <div className="ids-editor">
      <div className="ids-editor__field">
        <label htmlFor="ids-title">{t("author.decisionSession.fields.title")}</label>
        <input id="ids-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-question">{t("author.decisionSession.fields.question")}</label>
        <textarea
          id="ids-question"
          rows={3}
          value={decisionQuestion}
          onChange={(event) => setDecisionQuestion(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-context">{t("author.decisionSession.fields.context")}</label>
        <textarea
          id="ids-context"
          rows={5}
          value={decisionContext}
          onChange={(event) => setDecisionContext(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-objectives">{t("author.decisionSession.fields.objectives")}</label>
        <textarea
          id="ids-objectives"
          rows={4}
          value={objectives}
          onChange={(event) => setObjectives(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-options">{t("author.decisionSession.fields.options")}</label>
        <textarea
          id="ids-options"
          rows={4}
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-args">{t("author.decisionSession.fields.arguments")}</label>
        <textarea
          id="ids-args"
          rows={4}
          value={supportingArguments}
          onChange={(event) => setSupportingArguments(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-risks">{t("author.decisionSession.fields.risks")}</label>
        <textarea
          id="ids-risks"
          rows={3}
          value={risks}
          onChange={(event) => setRisks(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-deps">{t("author.decisionSession.fields.dependencies")}</label>
        <textarea
          id="ids-deps"
          rows={3}
          value={dependencies}
          onChange={(event) => setDependencies(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-resources">{t("author.decisionSession.fields.requiredResources")}</label>
        <textarea
          id="ids-resources"
          rows={3}
          value={requiredResources}
          onChange={(event) => setRequiredResources(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-timeline">{t("author.decisionSession.fields.timeline")}</label>
        <textarea
          id="ids-timeline"
          rows={3}
          value={suggestedTimeline}
          onChange={(event) => setSuggestedTimeline(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-participants">{t("author.decisionSession.fields.participants")}</label>
        <textarea
          id="ids-participants"
          rows={3}
          value={suggestedParticipants}
          onChange={(event) => setSuggestedParticipants(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-roles">{t("author.decisionSession.fields.roles")}</label>
        <textarea
          id="ids-roles"
          rows={3}
          value={suggestedResponsibleRoles}
          onChange={(event) => setSuggestedResponsibleRoles(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-unresolved">{t("author.decisionSession.fields.unresolvedQuestions")}</label>
        <textarea
          id="ids-unresolved"
          rows={3}
          value={unresolvedQuestions}
          onChange={(event) => setUnresolvedQuestions(event.target.value)}
        />
      </div>

      {error ? <p className="ids-source-panel__empty">{error}</p> : null}
      {applyNotice ? (
        <p className="ids-source-panel__empty" role="status">
          {applyNotice}
        </p>
      ) : null}

      <div className="ids-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, t("author.decisionSession.generateDecisionDraft"))}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {actions.saveLabel(publishPhase.phase, actions.publish)}
        </WorkspaceButton>
      </div>
    </div>
  );
}
