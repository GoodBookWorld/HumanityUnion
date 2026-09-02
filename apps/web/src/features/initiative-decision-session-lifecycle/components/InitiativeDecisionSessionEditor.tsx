"use client";

import { useMemo, useState } from "react";

import type { DecisionSession, InitiativeDecisionSessionDraft } from "@hu/types";

import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
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
    onAppliedNotice: (text) => {
      setApplyNotice(text);
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
      setError(err instanceof Error ? err.message : "Generate failed.");
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
      setError(err instanceof Error ? err.message : "Save failed.");
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
      setError(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="ids-editor">
      <div className="ids-editor__field">
        <label htmlFor="ids-title">Decision Title</label>
        <input id="ids-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-question">Decision Question</label>
        <textarea
          id="ids-question"
          rows={3}
          value={decisionQuestion}
          onChange={(event) => setDecisionQuestion(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-context">Decision Context</label>
        <textarea
          id="ids-context"
          rows={5}
          value={decisionContext}
          onChange={(event) => setDecisionContext(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-objectives">Objectives (one per line)</label>
        <textarea
          id="ids-objectives"
          rows={4}
          value={objectives}
          onChange={(event) => setObjectives(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-options">Decision Options (one per line)</label>
        <textarea
          id="ids-options"
          rows={4}
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-args">Supporting Arguments (one per line)</label>
        <textarea
          id="ids-args"
          rows={4}
          value={supportingArguments}
          onChange={(event) => setSupportingArguments(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-risks">Risks (one per line)</label>
        <textarea
          id="ids-risks"
          rows={3}
          value={risks}
          onChange={(event) => setRisks(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-deps">Dependencies (one per line)</label>
        <textarea
          id="ids-deps"
          rows={3}
          value={dependencies}
          onChange={(event) => setDependencies(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-resources">Required Resources (one per line)</label>
        <textarea
          id="ids-resources"
          rows={3}
          value={requiredResources}
          onChange={(event) => setRequiredResources(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-timeline">Suggested Timeline</label>
        <textarea
          id="ids-timeline"
          rows={3}
          value={suggestedTimeline}
          onChange={(event) => setSuggestedTimeline(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-participants">Suggested Participants (one per line)</label>
        <textarea
          id="ids-participants"
          rows={3}
          value={suggestedParticipants}
          onChange={(event) => setSuggestedParticipants(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-roles">Suggested Responsible Roles (one per line)</label>
        <textarea
          id="ids-roles"
          rows={3}
          value={suggestedResponsibleRoles}
          onChange={(event) => setSuggestedResponsibleRoles(event.target.value)}
        />
      </div>
      <div className="ids-editor__field">
        <label htmlFor="ids-unresolved">Unresolved Questions (one per line)</label>
        <textarea
          id="ids-unresolved"
          rows={3}
          value={unresolvedQuestions}
          onChange={(event) => setUnresolvedQuestions(event.target.value)}
        />
      </div>

      {error ? <p className="ids-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="ids-source-panel__empty">{applyNotice}</p> : null}

      <div className="ids-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, actions.generate)}
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
