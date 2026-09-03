"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { buildNewsSharePayload } from "../public-news-initiative-discovery.utils";

interface PublicNewsShareButtonProps {
  article: PublicNewsArticleItem;
}

export function PublicNewsShareButton({ article }: PublicNewsShareButtonProps) {
  const t = useTranslations("publicNews.card");
  const [status, setStatus] = useState<string | null>(null);

  async function handleShare() {
    const payload = buildNewsSharePayload(article);

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        setStatus(t("shared"));
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.url);
        setStatus(t("linkCopied"));
        return;
      }

      setStatus(t("copyUnavailable"));
    } catch {
      setStatus(null);
    }
  }

  return (
    <button
      type="button"
      className="public-news-card__button public-news-card__button--secondary"
      aria-label={t("shareAria", { title: article.title })}
      onClick={() => void handleShare()}
    >
      {t("share")}
      {status ? <span className="public-news-card__button-status">{status}</span> : null}
    </button>
  );
}
