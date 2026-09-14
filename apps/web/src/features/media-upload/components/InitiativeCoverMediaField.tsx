"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { InitiativeCoverMedia } from "@hu/types";

import { ExternalVideoEmbed } from "../../initiatives/components/ExternalVideoEmbed";
import {
  INITIATIVE_COVER_CROP_FRAME,
  INITIATIVE_COVER_OUTPUT_HEIGHT,
  INITIATIVE_COVER_OUTPUT_WIDTH,
  initiativeCoverCropBlobToFile,
  loadInitiativeCoverCropSource,
  type InitiativeCoverCropSource,
} from "../initiative-cover-crop";
import { resolveMediaUrl } from "../media-url";
import { ImageCropZoomEditor } from "./ImageCropZoomEditor";

import "./initiative-cover-media-field.css";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

type CoverMediaOption = "image" | "video_upload" | "video_external";

function resolveInitialOption(coverMedia?: InitiativeCoverMedia): CoverMediaOption {
  if (coverMedia?.type === "video_external") {
    return "video_external";
  }

  return "image";
}

/** YouTube serves a stable, predictable thumbnail per video id from its own CDN — no backend fetch involved. */
function resolveYouTubePosterUrl(providerVideoId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(providerVideoId)}/hqdefault.jpg`;
}

export interface InitiativeCoverMediaFieldProps {
  coverMedia?: InitiativeCoverMedia;
  altText?: string;
  onAltTextChange?: (value: string) => void;
  onImageUpload: (file: File) => Promise<InitiativeCoverMedia>;
  onVideoLinkSubmit: (url: string) => Promise<InitiativeCoverMedia>;
  onRemove: () => Promise<void> | void;
}

/**
 * UX Evolution Pack 03 Part 3 — "Initiative cover media": a single component
 * shared by the create-draft and published-edit forms (see
 * `InitiativeFormFields.tsx`), offering the three explicit options the task
 * requires. Pack 22D adds shared crop / centered-zoom before image upload.
 */
export function InitiativeCoverMediaField({
  coverMedia,
  altText,
  onAltTextChange,
  onImageUpload,
  onVideoLinkSubmit,
  onRemove,
}: InitiativeCoverMediaFieldProps) {
  const t = useTranslations("initiativeExperience");
  const inputRef = useRef<HTMLInputElement>(null);
  const groupName = useId();
  const [selectedOption, setSelectedOption] = useState<CoverMediaOption>(
    resolveInitialOption(coverMedia),
  );
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [cropSource, setCropSource] = useState<InitiativeCoverCropSource | null>(null);

  useEffect(() => {
    return () => {
      if (cropSource) {
        URL.revokeObjectURL(cropSource.objectUrl);
      }
    };
  }, [cropSource]);

  function closeCropEditor() {
    if (cropSource) {
      URL.revokeObjectURL(cropSource.objectUrl);
    }
    setCropSource(null);
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    try {
      const source = await loadInitiativeCoverCropSource(file);
      setCropSource(source);
    } catch (validationError) {
      // Client validation / upload errors without stable codes: preserve message when present.
      setError(
        validationError instanceof Error && validationError.message.trim()
          ? validationError.message
          : t("manage.cover.imageUploadFailed"),
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleCropSave(blob: Blob) {
    setBusy(true);
    setError(null);

    try {
      await onImageUpload(initiativeCoverCropBlobToFile(blob));
      closeCropEditor();
      setShowPlayer(false);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message.trim()
          ? uploadError.message
          : t("manage.cover.imageUploadFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVideoLinkSubmit() {
    const url = videoUrlDraft.trim();

    if (!url) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onVideoLinkSubmit(url);
      setVideoUrlDraft("");
      setShowPlayer(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message
          : t("manage.cover.videoLinkFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);

    try {
      await onRemove();
      setShowPlayer(false);
    } catch (removeError) {
      setError(
        removeError instanceof Error && removeError.message.trim()
          ? removeError.message
          : t("manage.cover.mediaRemovalFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="initiative-cover-media-field">
      <span className="initiative-cover-media-field__label">{t("manage.cover.label")}</span>
      <p className="initiative-cover-media-field__helper">{t("manage.cover.helper")}</p>

      <div className="initiative-cover-media-field__preview">
        {coverMedia?.type === "image" ? (
          <img
            src={resolveMediaUrl(coverMedia.url)}
            alt={altText || ""}
            className="initiative-cover-media-field__image"
          />
        ) : coverMedia?.type === "video_external" && coverMedia.provider && coverMedia.providerVideoId ? (
          showPlayer ? (
            <ExternalVideoEmbed
              provider={coverMedia.provider}
              providerVideoId={coverMedia.providerVideoId}
              title={t("manage.cover.videoPreviewTitle")}
              className="initiative-cover-media-field__video"
            />
          ) : (
            <div className="initiative-cover-media-field__video-poster">
              {coverMedia.provider === "youtube" ? (
                <img
                  src={resolveYouTubePosterUrl(coverMedia.providerVideoId)}
                  alt=""
                  aria-hidden="true"
                  className="initiative-cover-media-field__image"
                />
              ) : null}
              <button
                type="button"
                className="initiative-cover-media-field__play"
                onClick={() => setShowPlayer(true)}
                aria-label={t("manage.cover.playPreview")}
              >
                <span aria-hidden="true">▶</span> {t("manage.cover.playPreview")}
              </button>
            </div>
          )
        ) : (
          <p className="initiative-cover-media-field__placeholder" role="status">
            {t("manage.cover.noMedia")}
          </p>
        )}
      </div>

      {cropSource ? (
        <ImageCropZoomEditor
          source={cropSource}
          frame={INITIATIVE_COVER_CROP_FRAME}
          mask="rect"
          ariaLabel={t("manage.cover.cropAria")}
          instructions={t("manage.cover.cropInstructions")}
          saveLabel={t("manage.cover.saveCover")}
          savingLabel={t("manage.cover.savingCover")}
          cancelLabel={t("manage.cover.cancelCrop")}
          resetLabel={t("manage.cover.resetCrop")}
          zoomHint={t("manage.cover.zoomHint")}
          outputWidth={INITIATIVE_COVER_OUTPUT_WIDTH}
          outputHeight={INITIATIVE_COVER_OUTPUT_HEIGHT}
          onCancel={closeCropEditor}
          onSave={handleCropSave}
        />
      ) : null}

      <fieldset className="initiative-cover-media-field__options">
        <legend>{t("manage.cover.typeLegend")}</legend>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "image"}
            onChange={() => setSelectedOption("image")}
          />
          {t("manage.cover.uploadImage")}
        </label>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "video_upload"}
            onChange={() => setSelectedOption("video_upload")}
          />
          {t("manage.cover.uploadVideo")}
        </label>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "video_external"}
            onChange={() => setSelectedOption("video_external")}
          />
          {t("manage.cover.addVideoLink")}
        </label>
      </fieldset>

      {selectedOption === "image" ? (
        <div className="initiative-cover-media-field__panel">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            aria-label={t("manage.cover.chooseImageFileAria")}
            className="initiative-cover-media-field__input"
            onChange={(event) => void handleFileSelected(event)}
          />
          <div className="initiative-cover-media-field__actions">
            <button
              type="button"
              className="hu-button hu-button--secondary hu-button--sm"
              disabled={busy || Boolean(cropSource)}
              onClick={() => inputRef.current?.click()}
            >
              {coverMedia?.type === "image"
                ? t("manage.cover.replaceMedia")
                : t("manage.cover.chooseImage")}
            </button>
          </div>
          {onAltTextChange ? (
            <label className="initiative-cover-media-field__alt">
              <span>{t("manage.cover.imageAltText")}</span>
              <input value={altText ?? ""} onChange={(event) => onAltTextChange(event.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}

      {selectedOption === "video_upload" ? (
        <p className="initiative-cover-media-field__notice" role="status">
          {t("manage.cover.videoUploadUnavailable")}
        </p>
      ) : null}

      {selectedOption === "video_external" ? (
        <div className="initiative-cover-media-field__panel">
          <label className="initiative-cover-media-field__video-link-field">
            <span>{t("manage.cover.videoLinkLabel")}</span>
            <input
              type="url"
              inputMode="url"
              value={videoUrlDraft}
              placeholder={t("manage.cover.videoLinkPlaceholder")}
              onChange={(event) => setVideoUrlDraft(event.target.value)}
            />
          </label>
          <div className="initiative-cover-media-field__actions">
            <button
              type="button"
              className="hu-button hu-button--secondary hu-button--sm"
              disabled={busy || !videoUrlDraft.trim()}
              onClick={() => void handleVideoLinkSubmit()}
            >
              {coverMedia?.type === "video_external"
                ? t("manage.cover.replaceMedia")
                : t("manage.cover.addVideoLinkAction")}
            </button>
          </div>
        </div>
      ) : null}

      {coverMedia ? (
        <div className="initiative-cover-media-field__actions">
          <button
            type="button"
            className="hu-button hu-button--secondary hu-button--sm"
            disabled={busy || Boolean(cropSource)}
            onClick={() => void handleRemove()}
          >
            {t("manage.cover.removeMedia")}
          </button>
        </div>
      ) : null}

      {busy ? <p className="initiative-cover-media-field__status">{t("manage.cover.working")}</p> : null}
      {error ? (
        <p className="initiative-cover-media-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
