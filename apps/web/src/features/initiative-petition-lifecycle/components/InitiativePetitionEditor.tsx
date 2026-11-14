"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { InitiativePetitionDraft } from "@hu/types";

import { TranslateDraftControl } from "../../language";
import { useLifecycleAiFormApply } from "../../lifecycle-ai-assistant";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { formatLifecycleAiApplyNotice } from "../../public-initiative-experience/initiative-experience-i18n";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativePetitionDraft,
  publishInitiativePetitionStage,
  saveInitiativePetitionDraft,
} from "../api";
import { PetitionEditorFields, type PetitionEditorFieldsValues } from "./PetitionEditorFields";

interface PetitionApplyForm {
  title: string;
  publicSummary: string;
  requestStatement: string;
  expectedOutcome: string;
  supportingContext: string;
  keyArguments: string;
}

interface InitiativePetitionEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativePetitionDraft;
  readonly onDraftUpdated: (draft: InitiativePetitionDraft) => void;
  readonly onPublished: () => void;
  readonly onTogglePreview: () => void;
}

function detailFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

/**
 * Initiative Lifecycle — Part F, Section 3/6 (Petition Draft Builder /
 * Petition Workspace).
 *
 * The Author's editable working Petition draft: Generate (deterministic
 * Petition Builder — recomputes every suggested field from the current
 * Intelligence Snapshot, replacing prior generated values), free-text
 * Title / Public Summary / Request Statement / Expected Outcome /
 * Supporting Context / Key Arguments fields the Author freely edits
 * afterward, and Save Draft / Preview / Publish actions. No AI publishes
 * automatically and no signatures are pre-created — Publish is always an
 * explicit Author action.
 */
export function InitiativePetitionEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
}: InitiativePetitionEditorProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const actions = useAuthorActionLabels();
  const [title, setTitle] = useState(draft.title);
  const [publicSummary, setPublicSummary] = useState(draft.publicSummary);
  const [requestStatement, setRequestStatement] = useState(draft.requestStatement);
  const [expectedOutcome, setExpectedOutcome] = useState(draft.expectedOutcome);
  const [supportingContext, setSupportingContext] = useState(draft.supportingContext);
  const [keyArguments, setKeyArguments] = useState<string[]>(draft.keyArguments);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;

  const applyForm = useMemo<PetitionApplyForm>(
    () => ({
      title,
      publicSummary,
      requestStatement,
      expectedOutcome,
      supportingContext,
      keyArguments: keyArguments.join("\n"),
    }),
    [title, publicSummary, requestStatement, expectedOutcome, supportingContext, keyArguments],
  );

  useLifecycleAiFormApply({
    initiativeId,
    stageId: "petition",
    form: applyForm,
    onFormApplied: (next) => {
      setTitle(next.title);
      setPublicSummary(next.publicSummary);
      setRequestStatement(next.requestStatement);
      setExpectedOutcome(next.expectedOutcome);
      setSupportingContext(next.supportingContext);
      setKeyArguments(
        next.keyArguments
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      );
    },
    onAppliedNotice: ({ changedKeys }) =>
      setMessage({
        tone: "success",
        text: formatLifecycleAiApplyNotice({
          locale,
          stageId: "petition",
          changedKeys,
          t,
          saveDraft: actions.saveDraft,
          preview: actions.preview,
          publish: actions.publish,
        }),
      }),
  });

  function applyDraftToFields(updated: InitiativePetitionDraft) {
    setTitle(updated.title);
    setPublicSummary(updated.publicSummary);
    setRequestStatement(updated.requestStatement);
    setExpectedOutcome(updated.expectedOutcome);
    setSupportingContext(updated.supportingContext);
    setKeyArguments(updated.keyArguments);
    onDraftUpdated(updated);
  }

  function applyFieldChange(patch: Partial<PetitionEditorFieldsValues>) {
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.publicSummary !== undefined) setPublicSummary(patch.publicSummary);
    if (patch.requestStatement !== undefined) setRequestStatement(patch.requestStatement);
    if (patch.expectedOutcome !== undefined) setExpectedOutcome(patch.expectedOutcome);
    if (patch.supportingContext !== undefined) setSupportingContext(patch.supportingContext);
    if (patch.keyArguments !== undefined) setKeyArguments([...patch.keyArguments]);
  }

  async function handleGenerate() {
    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateInitiativePetitionDraft(initiativeId));
      applyDraftToFields(updated);
      setMessage({
        tone: "success",
        text: t("author.petition.messages.draftRebuilt"),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.petition.messages.generateFailed", {
          detail: detailFromError(error, t("author.petition.messages.unknownError")),
        }),
      });
    }
  }

  async function handleSave(): Promise<boolean> {
    setMessage(null);

    try {
      const updated = await savePhase.runSave(() =>
        saveInitiativePetitionDraft(initiativeId, {
          title,
          publicSummary,
          requestStatement,
          expectedOutcome,
          supportingContext,
          keyArguments: keyArguments.filter((argument) => argument.trim().length > 0),
        }),
      );
      applyDraftToFields(updated);
      setMessage({ tone: "success", text: t("author.petition.messages.draftSaved") });
      return true;
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.petition.messages.saveFailed", {
          detail: detailFromError(error, t("author.petition.messages.unknownError")),
        }),
      });
      return false;
    }
  }

  function unresolvedPublishRequirements(): string[] {
    const missing: string[] = [];
    if (!title.trim()) missing.push(t("author.petition.requiredFieldNames.title"));
    if (!publicSummary.trim()) missing.push(t("author.petition.requiredFieldNames.publicSummary"));
    if (!requestStatement.trim()) missing.push(t("author.petition.requiredFieldNames.requestStatement"));
    if (!expectedOutcome.trim()) missing.push(t("author.petition.requiredFieldNames.expectedOutcome"));
    if (!draft.revisionId || draft.revisionVersion === null) {
      missing.push(t("author.petition.requiredFieldNames.revisionReference"));
    }
    return missing;
  }

  async function handlePublish() {
    const missing = unresolvedPublishRequirements();
    if (missing.length > 0) {
      setMessage({
        tone: "error",
        text: t("author.petition.publishBlocked", { fields: missing.join("; ") }),
      });
      return;
    }

    if (
      !window.confirm(t("author.petition.confirm.publish"))
    ) {
      return;
    }

    setMessage(null);

    try {
      // Phase 04 — Save must succeed before Publish; never publish on a failed/stale save.
      const saved = await handleSave();
      if (!saved) {
        return;
      }

      await publishPhase.runSave(() => publishInitiativePetitionStage(initiativeId));
      setMessage({ tone: "success", text: t("author.petition.messages.published") });
      onPublished();
    } catch (error) {
      setMessage({
        tone: "error",
        text: t("author.petition.messages.publishFailed", {
          detail: detailFromError(error, t("author.petition.messages.unknownError")),
        }),
      });
    }
  }

  return (
    <div className="ipl-editor" aria-labelledby="ipl-editor-title">
      <div className="ipl-editor__header">
        <h3 id="ipl-editor-title">{t("author.petition.editorTitle")}</h3>
      </div>

      <div className="ipl-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {actions.saveLabel(generatePhase.phase, t("author.petition.generatePetitionDraft"))}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          {actions.preview}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          disabled={isBusy || unresolvedPublishRequirements().length > 0}
          onClick={() => void handlePublish()}
        >
          {resolveSaveButtonLabel(
            publishPhase.phase,
            t("author.petition.publishPetition"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
      </div>

      {unresolvedPublishRequirements().length > 0 ? (
        <p className="ipl-editor__message" data-tone="error" role="status">
          {t("author.petition.requiredBeforePublish", {
            fields: unresolvedPublishRequirements().join("; "),
          })}
        </p>
      ) : null}

      {message ? (
        <p className="ipl-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <PetitionEditorFields
        values={{
          title,
          publicSummary,
          requestStatement,
          expectedOutcome,
          supportingContext,
          keyArguments,
        }}
        onChange={applyFieldChange}
      />

      <TranslateDraftControl
        sourceKind="petition"
        sourceRecordId={draft.draftId || `petition-draft-${initiativeId}`}
        sourceVersion={draft.updatedAt || draft.createdAt || "draft"}
        initiativeId={initiativeId}
        draftContent={{
          title,
          publicSummary,
          requestStatement,
          expectedOutcome,
          supportingContext,
          keyArguments: keyArguments.join("\n"),
        }}
        onApplyWorkingTranslation={(fields) => {
          if (fields.title) setTitle(fields.title);
          if (fields.publicSummary) setPublicSummary(fields.publicSummary);
          if (fields.requestStatement) setRequestStatement(fields.requestStatement);
          if (fields.expectedOutcome) setExpectedOutcome(fields.expectedOutcome);
          if (fields.supportingContext) setSupportingContext(fields.supportingContext);
          if (fields.keyArguments) {
            setKeyArguments(
              fields.keyArguments
                .split("\n")
                .map((entry) => entry.trim())
                .filter(Boolean),
            );
          }
        }}
      />
    </div>
  );
}
