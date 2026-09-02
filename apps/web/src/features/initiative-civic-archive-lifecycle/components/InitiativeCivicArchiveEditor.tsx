"use client";

import { useMemo, useState } from "react";

import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveVersion,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { useSaveButtonPhase, resolveSaveButtonLabel } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { resolveCivicArchiveSectionDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativeCivicArchiveDraft,
  publishInitiativeCivicArchiveStage,
  saveInitiativeCivicArchiveDraft,
} from "../api";
import { InitiativeCivicArchiveCompletenessPanel } from "./InitiativeCivicArchiveCompletenessPanel";
import { InitiativeCivicArchiveShareToolbar } from "./InitiativeCivicArchiveShareToolbar";

interface ArchiveApplyForm {
  finalArchiveTitle: string;
  finalSummary: string;
  lessonsLearned: string;
  knowledgeContribution: string;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

interface InitiativeCivicArchiveEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativeCivicArchiveLifecycleDraft;
  readonly onDraftUpdated: (draft: InitiativeCivicArchiveLifecycleDraft) => void;
  readonly onPublished: (version: InitiativeCivicArchiveVersion) => void;
  readonly onTogglePreview: () => void;
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

export function InitiativeCivicArchiveEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
}: InitiativeCivicArchiveEditorProps) {
  const actions = useAuthorActionLabels();
  const { t } = actions;
  const [finalArchiveTitle, setFinalArchiveTitle] = useState(draft.finalArchiveTitle);
  const [finalSummary, setFinalSummary] = useState(draft.finalSummary);
  const [lessonsLearned, setLessonsLearned] = useState(draft.lessonsLearned);
  const [knowledgeContribution, setKnowledgeContribution] = useState(draft.knowledgeContribution);
  const [error, setError] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();

  const applyForm = useMemo<ArchiveApplyForm>(
    () => ({
      finalArchiveTitle,
      finalSummary,
      lessonsLearned,
      knowledgeContribution,
    }),
    [finalArchiveTitle, finalSummary, lessonsLearned, knowledgeContribution],
  );

  useLifecycleAiFormApply({
    initiativeId,
    stageId: "archive",
    form: applyForm,
    onFormApplied: (next) => {
      setFinalArchiveTitle(next.finalArchiveTitle);
      setFinalSummary(next.finalSummary);
      setLessonsLearned(next.lessonsLearned);
      setKnowledgeContribution(next.knowledgeContribution);
    },
    onAppliedNotice: () => {
      setApplyNotice(t("author.archive.messages.aiApplied"));
      setError(null);
    },
  });

  function buildSavePayload() {
    return {
      finalArchiveTitle,
      finalSummary,
      lessonsLearned,
      knowledgeContribution,
    };
  }

  async function handleGenerate() {
    setError(null);
    try {
      const generated = await generatePhase.runSave(() =>
        generateInitiativeCivicArchiveDraft(initiativeId),
      );
      setFinalArchiveTitle(generated.finalArchiveTitle);
      setFinalSummary(generated.finalSummary);
      setLessonsLearned(generated.lessonsLearned);
      setKnowledgeContribution(generated.knowledgeContribution);
      onDraftUpdated(generated);
    } catch (err) {
      setError(
        t("author.archive.messages.generateFailed", {
          detail: detailFromError(err, t("author.archive.messages.unknownError")),
        }),
      );
    }
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await savePhase.runSave(() =>
        saveInitiativeCivicArchiveDraft(initiativeId, buildSavePayload()),
      );
      onDraftUpdated(saved);
    } catch (err) {
      setError(
        t("author.archive.messages.saveFailed", {
          detail: detailFromError(err, t("author.archive.messages.unknownError")),
        }),
      );
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      await saveInitiativeCivicArchiveDraft(initiativeId, buildSavePayload());
      const version = await publishPhase.runSave(() =>
        publishInitiativeCivicArchiveStage(initiativeId),
      );
      setPublished(true);
      onPublished(version);
    } catch (err) {
      setError(
        t("author.archive.messages.publishFailed", {
          detail: detailFromError(err, t("author.archive.messages.unknownError")),
        }),
      );
    }
  }

  return (
    <div className="ica-editor">
      <InitiativeCivicArchiveShareToolbar initiativeId={initiativeId} mode="preview" />

      <InitiativeCivicArchiveCompletenessPanel completeness={draft.completeness} />

      <div className="ica-editor__field">
        <label htmlFor="ica-title">{t("author.archive.fields.finalArchiveTitle")}</label>
        <input
          id="ica-title"
          value={finalArchiveTitle}
          onChange={(event) => setFinalArchiveTitle(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-summary">{t("author.archive.fields.finalSummary")}</label>
        <textarea
          id="ica-summary"
          rows={3}
          value={finalSummary}
          onChange={(event) => setFinalSummary(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-lessons">{t("author.archive.fields.lessonsLearned")}</label>
        <textarea
          id="ica-lessons"
          rows={4}
          value={lessonsLearned}
          onChange={(event) => setLessonsLearned(event.target.value)}
        />
      </div>
      <div className="ica-editor__field">
        <label htmlFor="ica-knowledge">{t("author.archive.fields.knowledgeContribution")}</label>
        <textarea
          id="ica-knowledge"
          rows={4}
          value={knowledgeContribution}
          onChange={(event) => setKnowledgeContribution(event.target.value)}
        />
      </div>

      <p className="ica-source-panel__empty">{t("author.archive.sectionsReadOnly")}</p>

      {draft.sections.length === 0 ? (
        <p className="ica-source-panel__empty">{t("author.archive.noSectionsYet")}</p>
      ) : (
        draft.sections.map((section) => (
          <div className="ica-section" key={section.sectionId}>
            <div className="ica-section__header">
              <h4 className="ica-section__title">
                {resolveCivicArchiveSectionDisplayLabel(section.sectionId, t)}
              </h4>
              <span className="ica-section__status">
                {resolveCivicArchiveSectionDisplayLabel(section.sectionId, t)}
              </span>
            </div>
            <p className="ica-section__body">
              {section.body.trim() || t("author.archive.document.emptySection")}
            </p>
          </div>
        ))
      )}

      {error ? <p className="ica-source-panel__empty">{error}</p> : null}
      {applyNotice ? <p className="ica-source-panel__empty">{applyNotice}</p> : null}
      {published ? (
        <p className="ica-source-panel__empty">{t("author.archive.publishedNotice")}</p>
      ) : null}

      <div className="ica-editor__actions">
        <WorkspaceButton variant="secondary" onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, actions.generate)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" onClick={onTogglePreview}>{actions.preview}</WorkspaceButton>
        <WorkspaceButton variant="primary" onClick={() => void handlePublish()}>
          {resolveSaveButtonLabel(
            publishPhase.phase,
            t("author.archive.publishAndComplete"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
      </div>
    </div>
  );
}
