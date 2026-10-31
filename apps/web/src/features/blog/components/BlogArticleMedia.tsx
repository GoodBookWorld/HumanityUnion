"use client";

import { useState } from "react";

import type { BlogExternalVideo } from "@hu/types";

import { resolveMediaUrl } from "../../media-upload/media-url";
import { planBlogArticleMedia } from "../blog-article-video";
import { ExternalVideoEmbed } from "../../initiatives/components/ExternalVideoEmbed";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogArticleMediaProps {
  title: string;
  coverImage?: { mediaUrl?: string | null; altText?: string | null } | null;
  video?: BlogExternalVideo | null;
  priority?: boolean;
}

/**
 * The article's single cover or video block. A video poster mounts the
 * sandboxed player in the same 16:9 container only after Play is pressed.
 */
export function BlogArticleMedia({ title, coverImage, video, priority }: BlogArticleMediaProps) {
  const [playing, setPlaying] = useState(false);
  const plan = planBlogArticleMedia({
    hasCoverImage: Boolean(resolveMediaUrl(coverImage?.mediaUrl)),
    video,
  });

  if (plan.kind === "cover") {
    return (
      <div className="blog-article__cover">
        <BlogCoverImage
          title={title}
          imageUrl={coverImage?.mediaUrl}
          altText={coverImage?.altText}
          className="blog-article__cover-image"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className="blog-article__cover blog-article__video">
      <div className="blog-article__video-frame">
        {playing || !plan.poster ? (
          <ExternalVideoEmbed
            provider={plan.video.provider}
            providerVideoId={plan.video.providerVideoId}
            title={title}
          />
        ) : (
          <>
            {plan.poster.kind === "cover" ? (
              <BlogCoverImage
                title={title}
                imageUrl={coverImage?.mediaUrl}
                altText={coverImage?.altText}
                className="blog-article__media-poster"
                priority={priority}
              />
            ) : (
              <img
                src={plan.poster.url}
                alt={`Video preview for ${title}`}
                className="blog-article__media-poster blog-article__media-poster--thumbnail"
                loading={priority ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
              />
            )}
            <button
              type="button"
              className="blog-article__play-button"
              onClick={() => setPlaying(true)}
              aria-label={`Play video: ${title}`}
            >
              <span className="blog-article__play-icon" aria-hidden="true">
                ▶
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
