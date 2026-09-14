"use client";

import type { Initiative } from "@hu/types";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { HuFeedbackMessage } from "../../../design-system/components/HuFeedbackMessage";
import { ApiRequestError, isAuthenticationRequiredError, isNotFoundError } from "../../../lib/api-client";
import { buildWorkspaceInitiativesHref } from "../../initiative-owner-studio/initiative-experience-routes";
import { resolveLifecyclePhaseDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { submitInitiativeVideoLink, uploadInitiativeImage } from "../../media-upload/media-upload-api";
import {
  archiveInitiative,
  deleteInitiativeDraft,
  publishInitiative,
  saveInitiativeDraft,
  type SaveInitiativeDraftInput,
} from "../api";

import {
  buildInitiativeFormValuesFromMetadata,
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "./InitiativeFormFields";

import "./initiative-draft-editor.css";

interface InitiativeDraftEditorProps {
  initiative: Initiative;
  onUpdated: (initiative: Initiative) => void;
}

interface DraftFormState {
  title: string;
  description: string;
  fields: InitiativeFormValues;
}

interface DraftFormMessage {
  variant: "success" | "error";
  text: string;
}

function buildFormState(initiative: Initiative): DraftFormState {
  return {
    title: initiative.title,
    description: initiative.description,
    fields: buildInitiativeFormValuesFromMetadata(initiative.metadata),
  };
}

function detailFromError(error: unknown, unknownFallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : unknownFallback;
}

export function InitiativeDraftEditor({ initiative, onUpdated }: InitiativeDraftEditorProps) {
  const t = useTranslations("initiativeExperience");
  const router = useRouter();
  const [form, setForm] = useState<DraftFormState>(() => buildFormState(initiative));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<DraftFormMessage | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(buildFormState(initiative));
    setMessage(null);
  }, [initiative]);

  const isDraft = initiative.lifecyclePhase === "draft";

  function buildSaveInput(): SaveInitiativeDraftInput {
    return {
      title: form.title,
      description: form.description,
      ...initiativeFormValuesToSaveInput(form.fields, {
        isPublicChoice: initiative.lifecycleProfile === "PUBLIC_CHOICE",
      }),
    };
  }

  async function handleSaveDraft() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await saveInitiativeDraft(initiative.initiativeId, buildSaveInput());
      onUpdated(updated);
      setMessage({ variant: "success", text: t("manage.messages.draftSaved") });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage({ variant: "error", text: t("manage.messages.signInToCreate") });
      } else {
        setMessage({
          variant: "error",
          text: t("manage.messages.saveFailed", {
            detail: detailFromError(error, t("manage.messages.unknownError")),
          }),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);

    try {
      await saveInitiativeDraft(initiative.initiativeId, buildSaveInput());
      const published = await publishInitiative(initiative.initiativeId);
      onUpdated(published);
      setMessage({ variant: "success", text: t("manage.messages.published") });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage({ variant: "error", text: t("manage.messages.signInToCreate") });
      } else {
        setMessage({
          variant: "error",
          text: t("manage.messages.publishFailed", {
            detail: detailFromError(error, t("manage.messages.unknownError")),
          }),
        });
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const archived = await archiveInitiative(initiative.initiativeId);
      onUpdated(archived);
      setMessage({ variant: "success", text: t("manage.messages.archived") });
    } catch (error) {
      setMessage({
        variant: "error",
        text: t("manage.messages.archiveFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      });
    } finally {
      setArchiving(false);
    }
  }

  /**
   * Part 5/7/8 — the server is the sole source of truth for delete
   * eligibility (ownership + still-Draft), so every rejection it can
   * return is translated into a clear, specific message here rather than
   * a generic "delete failed". On success there is no Initiative left to
   * render, so this redirects to Workspace -> My Initiatives instead of
   * calling `onUpdated`.
   */
  async function handleConfirmDelete() {
    setDeleting(true);
    setMessage(null);

    try {
      await deleteInitiativeDraft(initiative.initiativeId);
      router.push(`${buildWorkspaceInitiativesHref()}?draftDeleted=1`);
    } catch (error) {
      setDeleteDialogOpen(false);
      setDeleting(false);

      if (isAuthenticationRequiredError(error)) {
        setMessage({ variant: "error", text: t("manage.messages.signInToDelete") });
        return;
      }

      if (isNotFoundError(error)) {
        setMessage({
          variant: "error",
          text: t("manage.messages.draftAlreadyDeleted"),
        });
        return;
      }

      if (error instanceof ApiRequestError && error.status === 403) {
        setMessage({
          variant: "error",
          text: t("manage.messages.deleteForbidden"),
        });
        return;
      }

      if (error instanceof ApiRequestError && error.status === 409) {
        setMessage({
          variant: "error",
          text: t("manage.messages.deleteConflict"),
        });
        return;
      }

      setMessage({
        variant: "error",
        text: t("manage.messages.deleteFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      });
    }
  }

  if (!isDraft) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">
          {t("manage.status.lifecyclePhase", {
            phase: resolveLifecyclePhaseDisplayLabel(initiative.lifecyclePhase, t),
          })}
        </p>
        {initiative.lifecyclePhase === "projected" ? (
          <p className="initiative-draft-editor__readonly">{t("manage.status.projectedHint")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="initiative-draft-editor">
      <label className="initiative-draft-editor__field">
        <span>{t("manage.fields.title")}</span>
        <input
          type="text"
          className="hu-form-control"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <label className="initiative-draft-editor__field">
        <span>{t("manage.fields.shortDescription")}</span>
        <textarea
          className="hu-form-control"
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          rows={4}
        />
      </label>

      <InitiativeFormFields
        values={form.fields}
        lifecycleProfile={initiative.lifecycleProfile}
        initiativeId={initiative.initiativeId}
        onChange={(patch) =>
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, ...patch },
          }))
        }
        onImageUpload={async (file) => {
          const uploaded = await uploadInitiativeImage(initiative.initiativeId, file);
          return uploaded.mediaUrl;
        }}
        onVideoLinkSubmit={(url) => submitInitiativeVideoLink(initiative.initiativeId, url)}
      />

      <p className="initiative-draft-editor__visibility">{t("manage.fields.visibilityPublic")}</p>

      {/*
       * UX Completion Pack 04 Part 6 — clear button hierarchy: Publish
       * (primary) leads, Save Draft (secondary) follows immediately beside
       * it, and Archive (tertiary, the only semi-destructive action here)
       * is visually separated to the far end of the row so it never
       * competes with — or is mistaken for — the two content actions.
       */}
      <div className="hu-form-actions initiative-draft-editor__actions">
        <Button
          type="button"
          variant="primary"
          onClick={() => void handlePublish()}
          disabled={saving || publishing || archiving || deleting}
        >
          {publishing ? t("manage.actions.publishing") : t("manage.actions.publish")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleSaveDraft()}
          disabled={saving || publishing || archiving || deleting}
        >
          {saving ? t("manage.actions.saving") : t("manage.actions.saveDraft")}
        </Button>
        <span className="initiative-draft-editor__archive-action">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => void handleArchive()}
            disabled={saving || publishing || archiving || deleting}
          >
            {archiving ? t("manage.actions.archiving") : t("manage.actions.archive")}
          </Button>
        </span>
      </div>

      {message ? (
        <HuFeedbackMessage variant={message.variant}>{message.text}</HuFeedbackMessage>
      ) : null}

      {/*
       * Part 3 — deliberately its own section below a visible divider, far
       * from Publish/Save Draft/Archive, so it is never one accidental
       * click away from those far more common actions.
       */}
      <div className="initiative-draft-editor__danger-zone">
        <div>
          <p className="initiative-draft-editor__danger-zone-title">
            {t("manage.actions.deleteThisDraft")}
          </p>
          <p className="initiative-draft-editor__danger-zone-description">
            {t("manage.danger.deleteDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={saving || publishing || archiving || deleting}
        >
          {t("manage.actions.deleteDraft")}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title={t("manage.danger.deleteConfirmTitle")}
        description={
          <>
            <p>{t("manage.danger.deleteConfirmBody1")}</p>
            <p>{t("manage.danger.deleteConfirmBody2")}</p>
          </>
        }
        confirmLabel={deleting ? t("manage.actions.deleting") : t("manage.actions.deleteDraft")}
        isConfirming={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
