"use client";

import { useRef, useState } from "react";

import "./media-image-upload-field.css";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

interface MediaImageUploadFieldProps {
  label: string;
  imageUrl?: string;
  altText?: string;
  onAltTextChange?: (value: string) => void;
  showAltTextField?: boolean;
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => Promise<void> | void;
  helperText?: string;
}

export function MediaImageUploadField({
  label,
  imageUrl,
  altText,
  onAltTextChange,
  showAltTextField = false,
  onUpload,
  onRemove,
  helperText,
}: MediaImageUploadFieldProps) {
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

  return (
    <div className="media-image-upload-field">
      <span className="media-image-upload-field__label">{label}</span>
      {helperText ? <p className="media-image-upload-field__helper">{helperText}</p> : null}

      <div className="media-image-upload-field__preview">
        {imageUrl ? (
          <img src={imageUrl} alt={altText || ""} className="media-image-upload-field__image" />
        ) : (
          <p className="media-image-upload-field__placeholder" role="status">
            No image selected
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="media-image-upload-field__input"
        onChange={(event) => void handleFileSelected(event)}
      />

      <div className="media-image-upload-field__actions">
        <button
          type="button"
          className="media-image-upload-field__button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {imageUrl ? "Replace Image" : "Choose Image"}
        </button>
        {imageUrl && onRemove ? (
          <button
            type="button"
            className="media-image-upload-field__button media-image-upload-field__button--secondary"
            disabled={uploading}
            onClick={() => void handleRemove()}
          >
            Remove Image
          </button>
        ) : null}
      </div>

      {showAltTextField && onAltTextChange ? (
        <label className="media-image-upload-field__alt">
          <span>Image alt text</span>
          <input value={altText ?? ""} onChange={(event) => onAltTextChange(event.target.value)} />
        </label>
      ) : null}

      {uploading ? <p className="media-image-upload-field__status">Uploading image…</p> : null}
      {error ? (
        <p className="media-image-upload-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
