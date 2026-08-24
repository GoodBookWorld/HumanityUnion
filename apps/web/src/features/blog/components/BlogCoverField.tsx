"use client";

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
      setError(uploadError instanceof Error ? uploadError.message : "Cover upload failed.");
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
            title={title || "Cover image"}
            imageUrl={coverMedia?.mediaUrl}
            altText={coverMedia?.altText}
            allowTitleAsAltFallback={false}
            className="blog-cover-field__image"
          />
        ) : (
          <div className="blog-cover-field__empty" role="img" aria-label="No cover image selected">
            <span className="hu-caption">No cover image selected</span>
          </div>
        )}
      </div>

      <div className="blog-cover-field__actions hu-form-actions">
        <label className="hu-button hu-button--secondary hu-button--sm" htmlFor={inputId}>
          {hasCover ? "Replace Cover" : "Upload Cover"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
            Remove Cover
          </Button>
        ) : null}
      </div>

      {uploading ? <HelperText>Uploading cover…</HelperText> : null}
      {error ? (
        <p className="hu-body" role="alert">
          {error}
        </p>
      ) : null}
      {coverMedia?.mediaUrl ? (
        <HelperText>Media: {resolveMediaUrl(coverMedia.mediaUrl) ?? coverMedia.mediaUrl}</HelperText>
      ) : null}

      <label className="hu-label" htmlFor={altId}>
        Image description / alt text
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
        placeholder="Describe the cover image for accessibility"
      />
      <HelperText>
        Required for accessibility when a cover is present. Do not invent descriptions automatically.
      </HelperText>
    </div>
  );
}
