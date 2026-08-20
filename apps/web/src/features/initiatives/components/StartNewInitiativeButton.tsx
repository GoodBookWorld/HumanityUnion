"use client";

import type { CommunityInitiativeRelationshipProjection, Initiative } from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../initiative-activity-areas";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { getCountryLabel } from "@hu/geography";
import { checkInitiativeSimilarity } from "../../community-intelligence/api";
import { InitiativeOverlapNotice } from "../../community-intelligence/components/InitiativeOverlapNotice";
import {
  OVERLAP_CHECK_UNAVAILABLE_MESSAGE,
  buildSimilarityDraftFingerprint,
  shouldSkipSimilarityCheck,
} from "../../community-intelligence/overlap-ux";
import { submitInitiativeVideoLink, uploadInitiativeImage } from "../../media-upload/media-upload-api";
import { fetchPublicNewsArticleById } from "../../public-news/api";
import { createInitiativeDraft, publishInitiative, saveInitiativeDraft } from "../api";
import { isAuthenticationRequiredError, isApiUnavailableError } from "../../../lib/api-client";
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
  ballotMode: "SUPPORT_OPPOSE",
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
  const [lifecycleProfile, setLifecycleProfile] = useState<"STANDARD" | "PUBLIC_CHOICE">("STANDARD");
  const [formValues, setFormValues] = useState<InitiativeFormValues>(DEFAULT_FORM_VALUES);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [overlapItems, setOverlapItems] = useState<CommunityInitiativeRelationshipProjection[]>(
    [],
  );
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState<string | null>(null);
  const [overlapCheckUnavailable, setOverlapCheckUnavailable] = useState(false);
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

  // Material draft changes invalidate a prior Continue acknowledgement so the
  // next publish may re-run a bounded similarity check. Unchanged drafts do not nag.
  useEffect(() => {
    if (!overlapAcknowledged || !acknowledgedFingerprint) {
      return;
    }
    const next = buildSimilarityDraftFingerprint({
      title,
      description,
      activityArea: formValues.activityArea,
      activityAreaOther: formValues.activityAreaOther || undefined,
      countryCode: formValues.countryCode || undefined,
      regionCode: formValues.regionCode || undefined,
      communityCode: formValues.communityCode || undefined,
      participationScope: formValues.participationScope,
      excludeInitiativeId: draftId,
    });
    if (next !== acknowledgedFingerprint) {
      setOverlapAcknowledged(false);
      setAcknowledgedFingerprint(null);
    }
  }, [
    acknowledgedFingerprint,
    description,
    draftId,
    formValues.activityArea,
    formValues.activityAreaOther,
    formValues.communityCode,
    formValues.countryCode,
    formValues.participationScope,
    formValues.regionCode,
    overlapAcknowledged,
    title,
  ]);

  async function persistDraft(): Promise<Initiative> {
    if (lifecycleProfile === "PUBLIC_CHOICE" && !formValues.countryCode.trim()) {
      throw new Error("Country is required for Public Choice initiatives.");
    }

    const saveInput = initiativeFormValuesToSaveInput(formValues, {
      isPublicChoice: lifecycleProfile === "PUBLIC_CHOICE",
    });
    const payloadBase =
      lifecycleProfile === "PUBLIC_CHOICE"
        ? {
            ...saveInput,
            // Do not invent an Activity area merely to satisfy STANDARD validation.
            activityArea: undefined as string | undefined,
            activityAreaOther: undefined as string | undefined,
          }
        : { ...saveInput, ballotMode: undefined };

    if (pendingImageFile) {
      // The selected file has not been uploaded yet — `formValues.coverMedia`
      // currently only holds a browser-local `blob:` preview URL (see
      // `onImageUpload` below), which must never be sent to the API. The
      // real, platform-hosted coverMedia is saved in a follow-up call below,
      // once the file has actually been uploaded.
      payloadBase.coverMedia = undefined;
      payloadBase.clearCoverMedia = false;
    }

    const payload = {
      title,
      description,
      lifecycleProfile,
      ...payloadBase,
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
        coverMedia: { type: "image", url: uploaded.mediaUrl, verificationStatus: "approved" },
      });
    }

    return initiative;
  }

  async function handleSaveDraft() {
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

  function currentSimilarityFingerprint(): string {
    return buildSimilarityDraftFingerprint({
      title,
      description,
      activityArea: formValues.activityArea,
      activityAreaOther: formValues.activityAreaOther || undefined,
      countryCode: formValues.countryCode || undefined,
      regionCode: formValues.regionCode || undefined,
      communityCode: formValues.communityCode || undefined,
      participationScope: formValues.participationScope,
      excludeInitiativeId: draftId,
    });
  }

  function handleContinueCreating() {
    // Acknowledge and collapse the notice. Do not publish, mutate draft text,
    // or suppress existing Initiatives — Author continues editing.
    const fingerprint = currentSimilarityFingerprint();
    setOverlapAcknowledged(true);
    setAcknowledgedFingerprint(fingerprint);
    setOverlapItems([]);
    setMessage(null);
    setIsSuccess(false);
  }

  async function handlePublish() {
    const fingerprint = currentSimilarityFingerprint();
    const skipOverlapCheck = shouldSkipSimilarityCheck({
      acknowledgeOverlap: false,
      overlapAcknowledged,
      currentFingerprint: fingerprint,
      acknowledgedFingerprint,
    });

    setCreating(true);
    setMessage(null);
    setIsSuccess(false);
    setAuthRequired(false);
    setOverlapCheckUnavailable(false);

    try {
      if (!skipOverlapCheck) {
        try {
          const similarity = await checkInitiativeSimilarity({
            title,
            description,
            activityArea: formValues.activityArea,
            activityAreaOther: formValues.activityAreaOther || undefined,
            countrySlug: formValues.countryCode || undefined,
            regionSlug: formValues.regionCode || undefined,
            communitySlug: formValues.communityCode || undefined,
            participationScope: formValues.participationScope,
            excludeInitiativeId: draftId ?? undefined,
          });

          if (similarity.hasStrongOverlap && similarity.items.length > 0) {
            setOverlapItems([...similarity.items]);
            setOverlapAcknowledged(false);
            setAcknowledgedFingerprint(null);
            setCreating(false);
            setMessage("Related Initiatives already exist. Review them or continue creating.");
            return;
          }

          setOverlapItems([]);
        } catch {
          // Community Intelligence must never block Initiative creation.
          setOverlapCheckUnavailable(true);
          setOverlapItems([]);
        }
      }

      const saved = await persistDraft();
      const published = await publishInitiative(saved.initiativeId);
      onCreated(published);
      setDraftId(published.initiativeId);
      setMessage("Initiative published successfully.");
      setIsSuccess(true);
      setTitle("");
      setDescription("");
      setLifecycleProfile("STANDARD");
      setFormValues(DEFAULT_FORM_VALUES);
      setPendingImageFile(null);
      setDraftId(null);
      setActiveSourceNewsId(null);
      setSourceArticle(null);
      setSourceRemoved(false);
      setSourcePrefillApplied(false);
      setOverlapItems([]);
      setOverlapAcknowledged(false);
      setAcknowledgedFingerprint(null);
      setOverlapCheckUnavailable(false);
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

      <fieldset className="start-new-initiative-button__profile">
        <legend>Lifecycle route</legend>
        <label className="start-new-initiative-button__profile-option">
          <input
            type="radio"
            name="lifecycleProfile"
            value="STANDARD"
            checked={lifecycleProfile === "STANDARD"}
            onChange={() => setLifecycleProfile("STANDARD")}
          />
          <span>
            <strong>Standard Initiative</strong>
            <small>
              Full civic lifecycle for developing, deciding, implementing and documenting an
              initiative.
            </small>
          </span>
        </label>
        <label className="start-new-initiative-button__profile-option">
          <input
            type="radio"
            name="lifecycleProfile"
            value="PUBLIC_CHOICE"
            checked={lifecycleProfile === "PUBLIC_CHOICE"}
            onChange={() => {
              setLifecycleProfile("PUBLIC_CHOICE");
              setFormValues((current) =>
                current.participationScope === "world"
                  ? { ...current, participationScope: "country" }
                  : current,
              );
            }}
          />
          <span>
            <strong>Public Choice</strong>
            <small>
              For choosing a candidate/person or another public choice through discussion and
              collective decision.
            </small>
          </span>
        </label>
      </fieldset>

      <InitiativeFormFields
        values={formValues}
        lifecycleProfile={lifecycleProfile}
        initiativeId={draftId ?? undefined}
        onChange={(patch) => setFormValues((current) => ({ ...current, ...patch }))}
        sourceArticle={sourceRemoved ? null : sourceArticle}
        onSourceRemove={sourceArticle && !sourceRemoved ? handleRemoveSource : undefined}
        onImageUpload={async (file) => {
          setPendingImageFile(file);
          return URL.createObjectURL(file);
        }}
        onVideoLinkSubmit={(url) => {
          setPendingImageFile(null);
          return submitInitiativeVideoLink(draftId ?? "", url);
        }}
        onImageRemove={() => {
          setPendingImageFile(null);
        }}
      />

      <p className="start-new-initiative-button__visibility">Visibility: Public</p>

      <InitiativeOverlapNotice items={overlapItems} onContinue={handleContinueCreating} />

      {overlapCheckUnavailable ? (
        <p className="start-new-initiative-button__message" role="status">
          {OVERLAP_CHECK_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}

      <div className="start-new-initiative-button__actions">
        <button
          type="button"
          className="start-new-initiative-button__action"
          onClick={() => void handleSaveDraft()}
          disabled={creating}
        >
          {creating ? "Saving…" : "Save Draft"}
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
