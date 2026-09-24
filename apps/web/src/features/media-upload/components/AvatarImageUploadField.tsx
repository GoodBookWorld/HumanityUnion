"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { avatarCropBlobToFile, loadAvatarCropSource, type AvatarCropSource } from "../avatar-crop";
import { AvatarCropEditor } from "./AvatarCropEditor";

import "./media-image-upload-field.css";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

interface AvatarImageUploadFieldProps {
  label: string;
  imageUrl?: string;
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => Promise<void> | void;
  helperText?: string;
}

export function AvatarImageUploadField({
  label,
  imageUrl,
  onUpload,
  onRemove,
  helperText,
}: AvatarImageUploadFieldProps) {
  const t = useTranslations("memberProfile.avatar");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<AvatarCropSource | null>(null);

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
      const source = await loadAvatarCropSource(file);
      setCropSource(source);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : t("uploadFailed"));
    } finally {
      event.target.value = "";
    }
  }

  async function handleCropSave(blob: Blob) {
    setUploading(true);
    setError(null);

    try {
      await onUpload(avatarCropBlobToFile(blob));
      closeCropEditor();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("uploadFailed"));
    } finally {
      setUploading(false);
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
      setError(removeError instanceof Error ? removeError.message : t("removeFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="media-image-upload-field">
      <span className="media-image-upload-field__label">{label}</span>
      {helperText ? <p className="media-image-upload-field__helper">{helperText}</p> : null}

      <div className="media-image-upload-field__preview media-image-upload-field__preview--avatar">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="media-image-upload-field__image" />
        ) : (
          <p className="media-image-upload-field__placeholder" role="status">
            {t("empty")}
          </p>
        )}
      </div>

      {cropSource ? (
        <AvatarCropEditor source={cropSource} onCancel={closeCropEditor} onSave={handleCropSave} />
      ) : null}

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
          className="hu-button hu-button--secondary hu-button--sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {imageUrl ? t("replace") : t("choose")}
        </button>
        {imageUrl && onRemove ? (
          <button
            type="button"
            className="hu-button hu-button--secondary hu-button--sm"
            disabled={uploading}
            onClick={() => void handleRemove()}
          >
            {t("remove")}
          </button>
        ) : null}
      </div>

      {uploading ? <p className="media-image-upload-field__status">{t("uploading")}</p> : null}
      {error ? (
        <p className="media-image-upload-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
