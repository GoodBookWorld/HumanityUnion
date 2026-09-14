"use client";

import type { Initiative } from "@hu/types";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { submitInitiativeVideoLink, uploadInitiativeImage } from "../../media-upload/media-upload-api";
import {
  archiveInitiative,
  closePublicChoiceElection,
  republishInitiative,
  updatePublishedInitiative,
  type SaveInitiativeDraftInput,
} from "../api";

import {
  buildInitiativeFormValuesFromMetadata,
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "./InitiativeFormFields";

import "./initiative-draft-editor.css";

interface InitiativePublishedEditorProps {
  initiative: Initiative;
  onUpdated: (initiative: Initiative) => void;
}

interface PublishedFormState {
  title: string;
  description: string;
  fields: InitiativeFormValues;
}

function buildFormState(initiative: Initiative): PublishedFormState {
  return {
    title: initiative.title,
    description: initiative.description,
    fields: buildInitiativeFormValuesFromMetadata(initiative.metadata),
  };
}

function detailFromError(error: unknown, unknownFallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : unknownFallback;
}

export function InitiativePublishedEditor({
  initiative,
  onUpdated,
}: InitiativePublishedEditorProps) {
  const t = useTranslations("initiativeExperience");
  const [form, setForm] = useState<PublishedFormState>(() => buildFormState(initiative));
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [closingElection, setClosingElection] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(initiative));
    setMessage(null);
  }, [initiative]);

  const isArchived = initiative.lifecyclePhase === "archived";
  const isPublicChoice = initiative.lifecycleProfile === "PUBLIC_CHOICE";

  function buildInput(): SaveInitiativeDraftInput {
    return {
      title: form.title,
      description: form.description,
      ...initiativeFormValuesToSaveInput(form.fields, {
        isPublicChoice,
      }),
    };
  }

  async function handleUpdate() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await updatePublishedInitiative(initiative.initiativeId, buildInput());
      onUpdated(updated);
      setMessage(t("manage.messages.updated"));
    } catch (error) {
      setMessage(
        t("manage.messages.updateFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRepublish() {
    setRepublishing(true);
    setMessage(null);

    try {
      const republished = await republishInitiative(initiative.initiativeId, buildInput());
      onUpdated(republished);
      setMessage(t("manage.messages.republished"));
    } catch (error) {
      setMessage(
        t("manage.messages.republishFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      );
    } finally {
      setRepublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setMessage(null);

    try {
      const archived = await archiveInitiative(initiative.initiativeId);
      onUpdated(archived);
      setMessage(t("manage.messages.archivedProjected"));
    } catch (error) {
      setMessage(
        t("manage.messages.archiveFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      );
    } finally {
      setArchiving(false);
    }
  }

  async function handleCloseElection() {
    setClosingElection(true);
    setMessage(null);
    try {
      await closePublicChoiceElection(initiative.initiativeId);
      setConfirmClose(false);
      setMessage(t("manage.messages.electionClosed"));
    } catch (error) {
      setMessage(
        t("manage.messages.closeElectionFailed", {
          detail: detailFromError(error, t("manage.messages.unknownError")),
        }),
      );
    } finally {
      setClosingElection(false);
    }
  }

  if (isArchived) {
    return (
      <div className="initiative-draft-editor">
        <p className="initiative-draft-editor__readonly">{t("manage.status.archivedReadonly")}</p>
      </div>
    );
  }

  const busy = saving || republishing || archiving || closingElection;

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

      <div className="initiative-draft-editor__actions">
        <button type="button" onClick={() => void handleUpdate()} disabled={busy}>
          {saving ? t("manage.actions.updating") : t("manage.actions.update")}
        </button>
        <button type="button" onClick={() => void handleRepublish()} disabled={busy}>
          {republishing ? t("manage.actions.republishing") : t("manage.actions.republish")}
        </button>
        {isPublicChoice ? (
          <button type="button" onClick={() => setConfirmClose(true)} disabled={busy}>
            {closingElection ? t("manage.actions.closing") : t("manage.actions.closeElection")}
          </button>
        ) : (
          <button type="button" onClick={() => void handleArchive()} disabled={busy}>
            {archiving ? t("manage.actions.archiving") : t("manage.actions.archive")}
          </button>
        )}
      </div>

      {confirmClose ? (
        <div
          className="initiative-draft-editor__confirm"
          role="dialog"
          aria-labelledby="close-election-title"
        >
          <h3 id="close-election-title">{t("manage.election.confirmTitle")}</h3>
          <p>{t("manage.election.confirmBody")}</p>
          <div className="initiative-draft-editor__actions">
            <button type="button" onClick={() => setConfirmClose(false)} disabled={busy}>
              {t("manage.actions.cancel")}
            </button>
            <button type="button" onClick={() => void handleCloseElection()} disabled={busy}>
              {closingElection ? t("manage.actions.closing") : t("manage.actions.closeElection")}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="initiative-draft-editor__message">{message}</p> : null}
    </div>
  );
}
