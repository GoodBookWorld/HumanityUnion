"use client";

import { INITIATIVE_LIFECYCLE_PHASE_LABELS } from "../initiative-lifecycle-labels";
import type { Initiative } from "@hu/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { HuFeedbackMessage } from "../../../design-system/components/HuFeedbackMessage";
import { ApiRequestError, isAuthenticationRequiredError, isNotFoundError } from "../../../lib/api-client";
import { buildWorkspaceInitiativesHref } from "../../initiative-owner-studio/initiative-experience-routes";
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

export function InitiativeDraftEditor({ initiative, onUpdated }: InitiativeDraftEditorProps) {
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
      setMessage({ variant: "success", text: "Draft saved successfully." });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage({ variant: "error", text: "Sign in to create an initiative." });
      } else {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setMessage({ variant: "error", text: `Save failed: ${detail}` });
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
      setMessage({ variant: "success", text: "Initiative published successfully." });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("authentication")) {
        setMessage({ variant: "error", text: "Sign in to create an initiative." });
      } else {
        const detail = error instanceof Error ? error.message : "Unknown error";
        setMessage({ variant: "error", text: `Publish failed: ${detail}` });
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
      setMessage({ variant: "success", text: "Initiative archived." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ variant: "error", text: `Archive failed: ${detail}` });
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
        setMessage({ variant: "error", text: "Sign in to delete this draft." });
        return;
      }

      if (isNotFoundError(error)) {
        setMessage({
          variant: "error",
          text: "This Draft Initiative was already deleted or no longer exists.",
        });
        return;
      }

      if (error instanceof ApiRequestError && error.status === 403) {
        setMessage({
          variant: "error",
          text: "You do not have permission to delete this Draft Initiative.",
        });
        return;
      }

      if (error instanceof ApiRequestError && error.status === 409) {
        setMessage({
          variant: "error",
          text: "This Initiative can no longer be deleted as a draft (it may already be published, archived, or was just changed elsewhere).",
        });
        return;
      }

      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ variant: "error", text: `Delete failed: ${detail}` });
    }
  }

  if (!isDraft) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">
          Lifecycle phase: {INITIATIVE_LIFECYCLE_PHASE_LABELS[initiative.lifecyclePhase]}
        </p>
        {initiative.lifecyclePhase === "projected" ? (
          <p className="initiative-draft-editor__readonly">
            Public projection is available on the associated community experience page.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="initiative-draft-editor">
      <label className="initiative-draft-editor__field">
        <span>Title</span>
        <input
          type="text"
          className="hu-form-control"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <label className="initiative-draft-editor__field">
        <span>Short description</span>
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

      <p className="initiative-draft-editor__visibility">Visibility: Public</p>

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
          {publishing ? "Publishing..." : "Publish Initiative"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleSaveDraft()}
          disabled={saving || publishing || archiving || deleting}
        >
          {saving ? "Saving…" : "Save Draft"}
        </Button>
        <span className="initiative-draft-editor__archive-action">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => void handleArchive()}
            disabled={saving || publishing || archiving || deleting}
          >
            {archiving ? "Archiving..." : "Archive"}
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
          <p className="initiative-draft-editor__danger-zone-title">Delete this Draft</p>
          <p className="initiative-draft-editor__danger-zone-description">
            Permanently remove this unpublished Draft Initiative. This cannot be undone.
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={saving || publishing || archiving || deleting}
        >
          Delete Draft
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Draft Initiative?"
        description={
          <>
            <p>This Draft Initiative will be permanently removed.</p>
            <p>This action cannot be undone.</p>
          </>
        }
        confirmLabel={deleting ? "Deleting..." : "Delete Draft"}
        isConfirming={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
