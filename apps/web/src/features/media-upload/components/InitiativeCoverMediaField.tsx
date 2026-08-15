"use client";

import { useId, useRef, useState } from "react";

import type { InitiativeCoverMedia } from "@hu/types";

import { ExternalVideoEmbed } from "../../initiatives/components/ExternalVideoEmbed";
import { resolveMediaUrl } from "../media-url";

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
 * requires. "Upload video" is intentionally always disabled — see the
 * explanatory notice below and the Pack 03 final report for why raw video
 * upload is not offered as production-ready.
 */
export function InitiativeCoverMediaField({
  coverMedia,
  altText,
  onAltTextChange,
  onImageUpload,
  onVideoLinkSubmit,
  onRemove,
}: InitiativeCoverMediaFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const groupName = useId();
  const [selectedOption, setSelectedOption] = useState<CoverMediaOption>(
    resolveInitialOption(coverMedia),
  );
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onImageUpload(file);
      setShowPlayer(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
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
      setError(submitError instanceof Error ? submitError.message : "Video link could not be verified.");
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
      setError(removeError instanceof Error ? removeError.message : "Media removal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="initiative-cover-media-field">
      <span className="initiative-cover-media-field__label">Initiative cover media</span>
      <p className="initiative-cover-media-field__helper">
        Add an image, or an approved video link (YouTube or Vimeo), to represent this Initiative.
      </p>

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
              title="Initiative cover video preview"
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
              >
                <span aria-hidden="true">▶</span> Play video preview
              </button>
            </div>
          )
        ) : (
          <p className="initiative-cover-media-field__placeholder" role="status">
            No media selected
          </p>
        )}
      </div>

      <fieldset className="initiative-cover-media-field__options">
        <legend>Cover media type</legend>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "image"}
            onChange={() => setSelectedOption("image")}
          />
          Upload image
        </label>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "video_upload"}
            onChange={() => setSelectedOption("video_upload")}
          />
          Upload video
        </label>
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selectedOption === "video_external"}
            onChange={() => setSelectedOption("video_external")}
          />
          Add video link
        </label>
      </fieldset>

      {selectedOption === "image" ? (
        <div className="initiative-cover-media-field__panel">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            aria-label="Choose an image file"
            className="initiative-cover-media-field__input"
            onChange={(event) => void handleFileSelected(event)}
          />
          <div className="initiative-cover-media-field__actions">
            <button
              type="button"
              className="initiative-cover-media-field__button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {coverMedia?.type === "image" ? "Replace Media" : "Choose Image"}
            </button>
          </div>
          {onAltTextChange ? (
            <label className="initiative-cover-media-field__alt">
              <span>Image alt text</span>
              <input value={altText ?? ""} onChange={(event) => onAltTextChange(event.target.value)} />
            </label>
          ) : null}
        </div>
      ) : null}

      {selectedOption === "video_upload" ? (
        <p className="initiative-cover-media-field__notice" role="status">
          Video upload is not available yet: automated safety scanning and processing for uploaded
          video files has not been built. Please use <strong>Add video link</strong> with an approved
          YouTube or Vimeo URL instead.
        </p>
      ) : null}

      {selectedOption === "video_external" ? (
        <div className="initiative-cover-media-field__panel">
          <label className="initiative-cover-media-field__video-link-field">
            <span>Video link (YouTube or Vimeo, HTTPS only)</span>
            <input
              type="url"
              inputMode="url"
              value={videoUrlDraft}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(event) => setVideoUrlDraft(event.target.value)}
            />
          </label>
          <div className="initiative-cover-media-field__actions">
            <button
              type="button"
              className="initiative-cover-media-field__button"
              disabled={busy || !videoUrlDraft.trim()}
              onClick={() => void handleVideoLinkSubmit()}
            >
              {coverMedia?.type === "video_external" ? "Replace Media" : "Add Video Link"}
            </button>
          </div>
        </div>
      ) : null}

      {coverMedia ? (
        <div className="initiative-cover-media-field__actions">
          <button
            type="button"
            className="initiative-cover-media-field__button initiative-cover-media-field__button--secondary"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            Remove Media
          </button>
        </div>
      ) : null}

      {busy ? <p className="initiative-cover-media-field__status">Working…</p> : null}
      {error ? (
        <p className="initiative-cover-media-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
