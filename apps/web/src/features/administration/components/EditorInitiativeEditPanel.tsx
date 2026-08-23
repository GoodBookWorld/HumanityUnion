"use client";

import type { Initiative } from "@hu/types";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import { submitInitiativeVideoLink, uploadInitiativeImage } from "../../media-upload/media-upload-api";
import {
  buildInitiativeFormValuesFromMetadata,
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "../../initiatives/components/InitiativeFormFields";
import {
  republishEditorInitiative,
  updateEditorInitiative,
} from "../editor-panel-api";

import "../../initiatives/components/initiative-draft-editor.css";

interface EditorInitiativeEditPanelProps {
  initiativeId: string;
  initial: Initiative;
  onClose: () => void;
  onSaved: (initiative: Initiative) => void;
}

interface FormState {
  title: string;
  description: string;
  fields: InitiativeFormValues;
}

function buildFormState(initiative: Initiative): FormState {
  return {
    title: initiative.title,
    description: initiative.description,
    fields: buildInitiativeFormValuesFromMetadata(initiative.metadata),
  };
}

/**
 * Pack 12B2 — Delegated editorial Initiative edit using canonical InitiativeFormFields.
 * No stewardship transfer, archive, or election close.
 */
export function EditorInitiativeEditPanel({
  initiativeId,
  initial,
  onClose,
  onSaved,
}: EditorInitiativeEditPanelProps) {
  const [initiative, setInitiative] = useState(initial);
  const [form, setForm] = useState<FormState>(() => buildFormState(initial));
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInitiative(initial);
    setForm(buildFormState(initial));
  }, [initial]);

  const isArchived = initiative.lifecyclePhase === "archived";
  const isPublicChoice = initiative.lifecycleProfile === "PUBLIC_CHOICE";
  const canRepublish =
    initiative.lifecyclePhase === "published" || initiative.lifecyclePhase === "projected";

  function buildInput(): Record<string, unknown> {
    return {
      title: form.title,
      description: form.description,
      ...initiativeFormValuesToSaveInput(form.fields, { isPublicChoice }),
    };
  }

  if (isArchived) {
    return (
      <div className="initiative-draft-editor">
        <p className="hu-caption">Archived initiatives cannot be edited.</p>
        <Button type="button" variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const busy = saving || republishing;

  return (
    <div className="initiative-draft-editor editor-panel__edit">
      <p className="hu-caption">
        Delegated editorial edit — stewardship is unchanged. Allowed fields: title, description,
        geography, cover/media, activity/participation metadata
        {isPublicChoice ? ", ballot mode" : ""}.
      </p>

      <label className="initiative-draft-editor__field">
        <span>Title</span>
        <input
          type="text"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <label className="initiative-draft-editor__field">
        <span>Short description</span>
        <textarea
          value={form.description}
          rows={4}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>

      <InitiativeFormFields
        values={form.fields}
        lifecycleProfile={initiative.lifecycleProfile}
        initiativeId={initiativeId}
        onChange={(patch) =>
          setForm((current) => ({
            ...current,
            fields: { ...current.fields, ...patch },
          }))
        }
        onImageUpload={async (file) => {
          const uploaded = await uploadInitiativeImage(initiativeId, file);
          return uploaded.mediaUrl;
        }}
        onVideoLinkSubmit={(url) => submitInitiativeVideoLink(initiativeId, url)}
      />

      {error ? <p className="hu-caption" role="alert">{error}</p> : null}
      {message ? <p className="hu-caption">{message}</p> : null}

      <div className="initiative-draft-editor__actions">
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          onClick={() => {
            setSaving(true);
            setError(null);
            setMessage(null);
            void updateEditorInitiative(initiativeId, buildInput())
              .then((updated) => {
                setInitiative(updated);
                setForm(buildFormState(updated));
                setMessage("Initiative updated.");
                onSaved(updated);
              })
              .catch((err: unknown) => setError(formatAuthFormError(err)))
              .finally(() => setSaving(false));
          }}
        >
          {saving ? "Updating…" : "Update"}
        </Button>
        {canRepublish ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setRepublishing(true);
              setError(null);
              setMessage(null);
              void republishEditorInitiative(initiativeId, buildInput())
                .then((updated) => {
                  setInitiative(updated);
                  setForm(buildFormState(updated));
                  setMessage("Initiative republished.");
                  onSaved(updated);
                })
                .catch((err: unknown) => setError(formatAuthFormError(err)))
                .finally(() => setRepublishing(false));
            }}
          >
            {republishing ? "Republishing…" : "Republish"}
          </Button>
        ) : null}
        <Button type="button" variant="tertiary" onClick={onClose} disabled={busy}>
          Close
        </Button>
      </div>
    </div>
  );
}
