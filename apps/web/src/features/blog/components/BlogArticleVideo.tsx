"use client";

import type { BlogExternalVideo } from "@hu/types";

import { acceptedBlogExternalVideo } from "../blog-article-video";
import { ExternalVideoEmbed } from "../../initiatives/components/ExternalVideoEmbed";

interface BlogArticleVideoProps {
  video: BlogExternalVideo;
  title: string;
}

/**
 * Renders a syndicated YouTube or Vimeo player from the stored provider and
 * video id. Unsupported identities render nothing. The embed URL is built by
 * the shared external-video component, never from article HTML.
 */
export function BlogArticleVideo({ video, title }: BlogArticleVideoProps) {
  const parsed = acceptedBlogExternalVideo(video);
  if (!parsed) {
    return null;
  }

  return (
    <div className="blog-article__video">
      <ExternalVideoEmbed
        provider={parsed.provider}
        providerVideoId={parsed.providerVideoId}
        title={title}
      />
    </div>
  );
}
