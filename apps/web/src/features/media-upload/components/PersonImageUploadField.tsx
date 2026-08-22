"use client";

import { useRef, useState } from "react";

import "./media-image-upload-field.css";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export type MediaImagePreviewVariant = "avatar" | "person" | "landscape";

export interface PersonImageUploadFieldProps {
  label: string;
  /** Resolved display URL for the current image. */
  imageUrl?: string | null;
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => Promise<void> | void;
  helperText?: string;
  disabled?: boolean;
  /** Person/candidate default: square rounded preview (not circular avatar). */
  variant?: Exclude<MediaImagePreviewVariant, "avatar">;
  chooseLabel?: string;
  replaceLabel?: string;
  removeLabel?: string;
  emptyLabel?: string;
}

/**
 * Pack 09A — Profile-aligned person/candidate image input.
 * Same interaction shell as AvatarImageUploadField (centered preview, replace,
 * loading, errors) without circular crop — portrait/person preview frame.
 * Reuses existing upload callbacks; does not invent storage endpoints.
 */
export function PersonImageUploadField({
  label,
  imageUrl,
  onUpload,
  onRemove,
  helperText,
  disabled = false,
  variant = "person",
  chooseLabel = "Choose photo",
  replaceLabel = "Replace photo",
  removeLabel = "Remove photo",
  emptyLabel = "No photo selected",
}: PersonImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleRemove() {
    if (!onRemove) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await onRemove();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Image removal failed.");
    } finally {
      setUploading(false);
    }
  }

  const previewModifier =
    variant === "landscape"
      ? "media-image-upload-field__preview--landscape"
      : "media-image-upload-field__preview--person";

  const busy = uploading || disabled;

  return (
    <div className="media-image-upload-field">
      <span className="media-image-upload-field__label">{label}</span>
      {helperText ? <p className="media-image-upload-field__helper">{helperText}</p> : null}

      <div className={`media-image-upload-field__preview ${previewModifier}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="media-image-upload-field__image"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <p className="media-image-upload-field__placeholder" role="status">
            {emptyLabel}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="media-image-upload-field__input"
        disabled={busy}
        onChange={(event) => void handleFileSelected(event)}
      />

      <div className="media-image-upload-field__actions">
        <button
          type="button"
          className="hu-button hu-button--secondary hu-button--sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {imageUrl ? replaceLabel : chooseLabel}
        </button>
        {imageUrl && onRemove ? (
          <button
            type="button"
            className="hu-button hu-button--secondary hu-button--sm"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>

      {uploading ? <p className="media-image-upload-field__status">Uploading photo…</p> : null}
      {error ? (
        <p className="media-image-upload-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
