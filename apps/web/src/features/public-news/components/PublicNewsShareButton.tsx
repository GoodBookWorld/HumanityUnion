"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useState } from "react";

import { buildNewsSharePayload } from "../public-news-initiative-discovery.utils";

interface PublicNewsShareButtonProps {
  article: PublicNewsArticleItem;
}

export function PublicNewsShareButton({ article }: PublicNewsShareButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleShare() {
    const payload = buildNewsSharePayload(article);

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        setStatus("Shared");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.url);
        setStatus("Link copied");
        return;
      }

      setStatus("Copy unavailable");
    } catch {
      setStatus(null);
    }
  }

  return (
    <button
      type="button"
      className="public-news-card__button public-news-card__button--secondary"
      aria-label={`Share article: ${article.title}`}
      onClick={() => void handleShare()}
    >
      Share
      {status ? <span className="public-news-card__button-status">{status}</span> : null}
    </button>
  );
}
