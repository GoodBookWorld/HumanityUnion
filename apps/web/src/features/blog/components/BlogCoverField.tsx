"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { BlogCoverMedia } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { uploadBlogImage } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { BlogCoverImage } from "./BlogCoverImage";

export interface BlogCoverFieldProps {
  /** Pack 15A — single canonical cover value (preview + form + save). */
  coverMedia: BlogCoverMedia | null;
  title: string;
  disabled?: boolean;
  onChange: (cover: BlogCoverMedia | null) => void;
}

export function BlogCoverField({ coverMedia, title, disabled, onChange }: BlogCoverFieldProps) {
  const t = useTranslations("workspace.publishingPage");
  const inputId = useId();
  const altId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadBlogImage(file);
      // Only update canonical cover after success — failed Replace keeps prior coverMedia.
      onChange({
        mediaId: uploaded.mediaId,
        mediaUrl: uploaded.mediaUrl,
        altText: coverMedia?.altText,
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("editor.media.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const hasCover = Boolean(coverMedia?.mediaUrl);

  return (
    <div className="blog-cover-field">
      <div className="blog-cover-field__preview">
        {hasCover ? (
          <BlogCoverImage
            title={title || t("editor.media.coverFallbackTitle")}
            imageUrl={coverMedia?.mediaUrl}
            altText={coverMedia?.altText}
            allowTitleAsAltFallback={false}
            className="blog-cover-field__image"
          />
        ) : (
          <div
            className="blog-cover-field__empty"
            role="img"
            aria-label={t("editor.media.noCoverAria")}
          >
            <span className="hu-caption">{t("editor.media.noCover")}</span>
          </div>
        )}
      </div>

      <div className="blog-cover-field__actions hu-form-actions">
        <label className="hu-button hu-button--secondary hu-button--sm" htmlFor={inputId}>
          {hasCover ? t("editor.media.replace") : t("editor.media.upload")}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          disabled={disabled || uploading}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {hasCover ? (
          <Button
            type="button"
            variant="tertiary"
            disabled={disabled || uploading}
            onClick={() => {
              setError(null);
              onChange(null);
            }}
          >
            {t("editor.media.remove")}
          </Button>
        ) : null}
      </div>

      {uploading ? <HelperText>{t("editor.media.uploading")}</HelperText> : null}
      {error ? (
        <p className="hu-body" role="alert">
          {error}
        </p>
      ) : null}
      {coverMedia?.mediaUrl ? (
        <HelperText>
          {t("editor.media.mediaUrlPrefix", {
            url: resolveMediaUrl(coverMedia.mediaUrl) ?? coverMedia.mediaUrl,
          })}
        </HelperText>
      ) : null}

      <label className="hu-label" htmlFor={altId}>
        {t("editor.media.altLabel")}
      </label>
      <input
        id={altId}
        className="hu-form-control"
        type="text"
        maxLength={200}
        disabled={disabled || !coverMedia}
        value={coverMedia?.altText ?? ""}
        onChange={(event) => {
          if (!coverMedia) {
            return;
          }
          onChange({
            ...coverMedia,
            altText: event.target.value,
          });
        }}
        placeholder={t("editor.media.altPlaceholder")}
      />
      <HelperText>{t("editor.media.altHelper")}</HelperText>
    </div>
  );
}
