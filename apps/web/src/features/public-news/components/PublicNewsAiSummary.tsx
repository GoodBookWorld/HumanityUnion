"use client";

import { useTranslations } from "next-intl";

interface PublicNewsAiSummaryProps {
  bullets: string[];
}

export function PublicNewsAiSummary({ bullets }: PublicNewsAiSummaryProps) {
  const t = useTranslations("publicNews.card");

  if (bullets.length === 0) {
    return null;
  }

  return (
    <section className="public-news-card__ai-summary" aria-label={t("aiSummaryAria")}>
      <ul className="public-news-card__ai-summary-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
