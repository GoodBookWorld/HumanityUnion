"use client";

import type { Initiative } from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../initiative-activity-areas";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { getCountryLabel } from "../../../data/geography";
import { uploadInitiativeImage } from "../../media-upload/media-upload-api";
import { fetchPublicNewsArticleById } from "../../public-news/api";
import { createInitiativeDraft, publishInitiative, saveInitiativeDraft } from "../api";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
import { getStoredAccessToken } from "../../auth/auth-token-store";
import {
  mapNewsCategoryToActivityArea,
  resolveInitiativeCreateNewsSourceId,
  resolveInitiativeCreateNewsSourceIdFromLocation,
  resolveNewsArticleCountryCode,
} from "../initiative-create-news-source";
import {
  InitiativeFormFields,
  initiativeFormValuesToSaveInput,
  type InitiativeFormValues,
} from "./InitiativeFormFields";

import "./start-new-initiative-button.css";

interface StartNewInitiativeButtonProps {
  onCreated: (initiative: Initiative) => void;
}

const DEFAULT_FORM_VALUES: InitiativeFormValues = {
  communityAssociation: "",
  activityArea: INITIATIVE_ACTIVITY_AREA_OPTIONS[4],
  activityAreaOther: "",
  participationScope: "community",
  countryCode: "",
  countryLabel: "",
  regionCode: "",
  regionLabel: "",
  communityCode: "",
  communityLabel: "",
};

function formatInitiativeError(error: unknown): string {
  if (isAuthenticationRequiredError(error)) {
    return "Sign in to create an initiative.";
  }

  if (isApiUnavailableError(error)) {
    return "The Humanity Union service is temporarily unavailable.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to save initiative.";
}

function resolveInitialNewsSourceId(searchParams: ReturnType<typeof useSearchParams>): string | null {
  return (
    resolveInitiativeCreateNewsSourceId(searchParams) ??
    resolveInitiativeCreateNewsSourceIdFromLocation()
  );
}

export function StartNewInitiativeButton({ onCreated }: StartNewInitiativeButtonProps) {
  const searchParams = useSearchParams();
  const initialNewsSourceId = resolveInitialNewsSourceId(searchParams);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formValues, setFormValues] = useState<InitiativeFormValues>(DEFAULT_FORM_VALUES);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [activeSourceNewsId, setActiveSourceNewsId] = useState<string | null>(initialNewsSourceId);
  const [sourceRemoved, setSourceRemoved] = useState(false);
  const [sourceArticle, setSourceArticle] = useState<Awaited<
    ReturnType<typeof fetchPublicNewsArticleById>
  > | null>(null);
  const [sourcePrefillApplied, setSourcePrefillApplied] = useState(false);

  useEffect(() => {
    const newsId = resolveInitialNewsSourceId(searchParams);

    if (newsId && newsId !== activeSourceNewsId && !sourceRemoved) {
      setActiveSourceNewsId(newsId);
    }
  }, [searchParams, activeSourceNewsId, sourceRemoved]);

  useEffect(() => {
    if (!activeSourceNewsId || sourceRemoved) {
      setSourceArticle(null);
      return;
    }

    let cancelled = false;

    void fetchPublicNewsArticleById(activeSourceNewsId)
      .then((article) => {
        if (cancelled) {
          return;
        }

        setSourceArticle(article);

        if (!sourcePrefillApplied) {
          setTitle(article.title);

          const activityArea = mapNewsCategoryToActivityArea(article.category);
          const countryCode = resolveNewsArticleCountryCode(article);

          setFormValues((current) => ({
            ...current,
            ...(activityArea ? { activityArea } : {}),
            ...(countryCode
              ? {
                  countryCode,
                  countryLabel: getCountryLabel(countryCode) ?? "",
                  participationScope: "country" as const,
                }
              : {}),
          }));
          setSourcePrefillApplied(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceArticle(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSourceNewsId, sourcePrefillApplied, sourceRemoved]);

  async function persistDraft(): Promise<Initiative> {
    const payload = {
      title,
      description,
      ...initiativeFormValuesToSaveInput(formValues),
      ...(draftId || !activeSourceNewsId || sourceRemoved ? {} : { sourceNewsId: activeSourceNewsId }),
      ...(draftId && sourceRemoved ? { clearSourceReferences: true } : {}),
    };

    let initiative = draftId
      ? await saveInitiativeDraft(draftId, payload)
      : await createInitiativeDraft(payload);

    if (!draftId) {
      setDraftId(initiative.initiativeId);
    }

    if (pendingImageFile) {
      const uploaded = await uploadInitiativeImage(initiative.initiativeId, pendingImageFile);
      initiative = await saveInitiativeDraft(initiative.initiativeId, {
        imageUrl: uploaded.mediaUrl,
      });
    }

    return initiative;
  }

  async function handleSaveDraft() {
    if (!getStoredAccessToken()) {
      setAuthRequired(true);
      setMessage("Sign in to create an initiative.");
      return;
    }

    setCreating(true);
    setMessage(null);
    setIsSuccess(false);
    setAuthRequired(false);

    try {
      const saved = await persistDraft();
      onCreated(saved);
      setMessage("Draft saved successfully.");
      setIsSuccess(true);
    } catch (error) {
      setAuthRequired(isAuthenticationRequiredError(error));
      setMessage(formatInitiativeError(error));
      setIsSuccess(false);
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish() {
    if (!getStoredAccessToken()) {
      setAuthRequired(true);
      setMessage("Sign in to create an initiative.");
      return;
    }

    setCreating(true);
    setMessage(null);
    setIsSuccess(false);
    setAuthRequired(false);

    try {
      const saved = await persistDraft();
      const published = await publishInitiative(saved.initiativeId);
      onCreated(published);
      setDraftId(published.initiativeId);
      setMessage("Initiative published successfully.");
      setIsSuccess(true);
      setTitle("");
      setDescription("");
      setFormValues(DEFAULT_FORM_VALUES);
      setPendingImageFile(null);
      setDraftId(null);
      setActiveSourceNewsId(null);
      setSourceArticle(null);
      setSourceRemoved(false);
      setSourcePrefillApplied(false);
    } catch (error) {
      setAuthRequired(isAuthenticationRequiredError(error));
      setMessage(formatInitiativeError(error));
      setIsSuccess(false);
    } finally {
      setCreating(false);
    }
  }

  function handleRemoveSource() {
    setActiveSourceNewsId(null);
    setSourceArticle(null);
    setSourceRemoved(true);
  }

  const returnTo = encodeURIComponent(
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/initiatives/create",
  );

  return (
    <div id="create" className="start-new-initiative-button">
      <label className="start-new-initiative-button__field">
        <span>Start New Initiative</span>
        <p>Title</p>
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="start-new-initiative-button__field">
        <p>Short description</p>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <InitiativeFormFields
        values={formValues}
        onChange={(patch) => setFormValues((current) => ({ ...current, ...patch }))}
        sourceArticle={sourceRemoved ? null : sourceArticle}
        onSourceRemove={sourceArticle && !sourceRemoved ? handleRemoveSource : undefined}
        onImageUpload={async (file) => {
          setPendingImageFile(file);
          return URL.createObjectURL(file);
        }}
        onImageRemove={() => {
          setPendingImageFile(null);
        }}
      />

      <p className="start-new-initiative-button__visibility">Visibility: Public</p>

      <div className="start-new-initiative-button__actions">
        <button
          type="button"
          className="start-new-initiative-button__action"
          onClick={() => void handleSaveDraft()}
          disabled={creating}
        >
          {creating ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          className="start-new-initiative-button__action start-new-initiative-button__action--primary"
          onClick={() => void handlePublish()}
          disabled={creating}
        >
          {creating ? "Publishing..." : "Publish Initiative"}
        </button>
      </div>

      {message ? (
        <p
          className={
            isSuccess
              ? "start-new-initiative-button__message start-new-initiative-button__message--success"
              : "start-new-initiative-button__message"
          }
          role={isSuccess ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}

      {authRequired ? (
        <div className="start-new-initiative-button__auth">
          <Link href={`/login?returnTo=${returnTo}`}>Log In</Link>
          <Link href={`/register?returnTo=${returnTo}`}>Create Account</Link>
        </div>
      ) : null}
    </div>
  );
}
