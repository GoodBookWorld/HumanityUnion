"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Petition } from "@hu/types";

import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { useAuthorActionLabels } from "../../public-initiative-experience/use-author-action-labels";
import {
  generatePetitionWorkingDraft,
  publishPetitionWorkingDraft,
  savePetitionWorkingDraft,
  type PetitionWorkingDraft,
} from "../api";
import {
  buildWorkingDraftSaveInput,
  classifyPetitionDraftError,
  presentWorkingDraftForEditor,
  unresolvedPetitionPublishRequirements,
  workingDraftHasContent,
  type PetitionDraftErrorKind,
  type PetitionDraftOperation,
  type PetitionEditorFieldValues,
} from "../petition-editing-workspace";
import { PetitionEditorFields } from "./PetitionEditorFields";

interface PetitionWorkingDraftEditorProps {
  readonly initiativeId: string;
  readonly draft: PetitionWorkingDraft;
  readonly onDraftUpdated: (draft: PetitionWorkingDraft) => void;
  readonly onPublished: (petition: Petition) => void;
  readonly onError: (kind: PetitionDraftErrorKind) => void;
  readonly onClose: () => void;
}

type PendingConfirmation = "generate" | "publish" | null;

function presentedHasContent(fields: PetitionEditorFieldValues): boolean {
  return (
    [
      fields.title,
      fields.publicSummary,
      fields.requestStatement,
      fields.expectedOutcome,
      fields.supportingContext,
    ].some((value) => value.trim().length > 0) ||
    fields.keyArguments.some((argument) => argument.trim().length > 0)
  );
}

/**
 * HU-LC-05C.4C.7C.2 — the Petition editor bound to one independent working
 * draft. Shares the Author Workspace editor's form, labels and publication
 * requirements; generation never replaces content and publication never
 * happens without an explicit confirmation.
 */
export function PetitionWorkingDraftEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onError,
  onClose,
}: PetitionWorkingDraftEditorProps) {
  const t = useTranslations("initiativeExperience");
  const actions = useAuthorActionLabels();
  const [canonical, setCanonical] = useState(draft);
  const [fields, setFields] = useState<PetitionEditorFieldValues>(() =>
    presentWorkingDraftForEditor(draft),
  );
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>(null);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;

  const missing = unresolvedPetitionPublishRequirements({
    fields,
    revisionId: canonical.revisionId,
    revisionVersion: canonical.revisionVersion,
  }).map((requirement) => t(`author.petition.requiredFieldNames.${requirement}`));

  function applySaved(updated: PetitionWorkingDraft) {
    setCanonical(updated);
    setFields(presentWorkingDraftForEditor(updated));
    onDraftUpdated(updated);
  }

  function reportError(
    error: unknown,
    operation: PetitionDraftOperation,
    overwrite?: boolean,
  ) {
    const kind = classifyPetitionDraftError(error, { operation, overwrite });
    setMessage({ tone: "error", text: t(`petitionEditing.errors.${kind}`) });
    onError(kind);
  }

  async function handleSave(): Promise<boolean> {
    setMessage(null);

    try {
      const updated = await savePhase.runSave(() =>
        savePetitionWorkingDraft(
          initiativeId,
          canonical.draftId,
          buildWorkingDraftSaveInput({ canonical, presented: fields }),
        ),
      );
      applySaved(updated);
      setMessage({ tone: "success", text: t("author.petition.messages.draftSaved") });
      return true;
    } catch (error) {
      reportError(error, "save");
      return false;
    }
  }

  async function runGenerate() {
    const overwrite = workingDraftHasContent(canonical);
    setConfirmation(null);
    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() =>
        generatePetitionWorkingDraft(initiativeId, canonical.draftId, overwrite),
      );
      applySaved(updated);
      setMessage({ tone: "success", text: t("author.petition.messages.draftRebuilt") });
    } catch (error) {
      reportError(error, "generate", overwrite);
    }
  }

  function requestGenerate() {
    if (workingDraftHasContent(canonical) || presentedHasContent(fields)) {
      setConfirmation("generate");
      return;
    }
    void runGenerate();
  }

  function requestPublish() {
    if (missing.length > 0) {
      setMessage({
        tone: "error",
        text: t("author.petition.publishBlocked", { fields: missing.join("; ") }),
      });
      return;
    }
    setConfirmation("publish");
  }

  async function runPublish() {
    setConfirmation(null);
    setMessage(null);

    // The confirmed content is saved first; a failed save never publishes.
    if (!(await handleSave())) {
      return;
    }

    try {
      const petition = await publishPhase.runSave(() =>
        publishPetitionWorkingDraft(initiativeId, canonical.draftId),
      );
      onPublished(petition);
    } catch (error) {
      reportError(error, "publish");
    }
  }

  return (
    <div className="ipl-editor" aria-labelledby={`ipl-working-draft-${canonical.draftId}`}>
      <div className="ipl-editor__header">
        <h3 id={`ipl-working-draft-${canonical.draftId}`}>{t("author.petition.editorTitle")}</h3>
      </div>

      <div className="ipl-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={requestGenerate}>
          {actions.saveLabel(generatePhase.phase, t("author.petition.generatePetitionDraft"))}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleSave()}>
          {actions.saveLabel(savePhase.phase, actions.saveDraft)}
        </WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          disabled={isBusy || missing.length > 0}
          onClick={requestPublish}
        >
          {resolveSaveButtonLabel(
            publishPhase.phase,
            t("author.petition.publishPetition"),
            actions.phaseLabels,
          )}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onClose}>
          {t("petitionEditing.drafts.close")}
        </WorkspaceButton>
      </div>

      {missing.length > 0 ? (
        <p className="ipl-editor__message" data-tone="error" role="status">
          {t("author.petition.requiredBeforePublish", { fields: missing.join("; ") })}
        </p>
      ) : null}

      {message ? (
        <p className="ipl-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <PetitionEditorFields
        values={fields}
        disabled={isBusy}
        onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
      />

      <ConfirmDialog
        isOpen={confirmation === "generate"}
        title={t("petitionEditing.confirm.generate.title")}
        description={t("petitionEditing.confirm.generate.description")}
        confirmLabel={t("petitionEditing.confirm.generate.confirm")}
        isConfirming={generatePhase.isBusy}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runGenerate()}
      />
      <ConfirmDialog
        isOpen={confirmation === "publish"}
        destructive={false}
        title={t("petitionEditing.confirm.publish.title")}
        description={t("petitionEditing.confirm.publish.description")}
        confirmLabel={t("petitionEditing.confirm.publish.confirm")}
        isConfirming={publishPhase.isBusy}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runPublish()}
      />
    </div>
  );
}
