"use client";

import { useTranslations } from "next-intl";

import {
  MediaSemanticNode,
  type MediaSemanticResult,
} from "../../language/media-plp/media-semantic-contract";

interface PublicNewsAiSummaryProps {
  bullets: string[];
  entityResult?: MediaSemanticResult;
  entityId?: string;
}

export function PublicNewsAiSummary({
  bullets,
  entityResult,
  entityId,
}: PublicNewsAiSummaryProps) {
  const t = useTranslations("publicNews.card");

  if (bullets.length === 0) {
    return null;
  }

  return (
    <section className="public-news-card__ai-summary" aria-label={t("aiSummaryAria")}>
      <ul className="public-news-card__ai-summary-list">
        {bullets.map((bullet) => (
          <li key={bullet}>
            {entityResult && entityId ? (
              <MediaSemanticNode
                as="span"
                owner="PLP_ENTITY"
                result={entityResult}
                entityType="public_news"
                entityId={entityId}
              >
                {bullet}
              </MediaSemanticNode>
            ) : (
              bullet
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
