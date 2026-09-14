"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useTranslations } from "next-intl";

import {
  buildNewsCreatePetitionHref,
  buildNewsCreateProposalHref,
  buildNewsSupportHref,
  buildNewsVolunteerHref,
} from "../public-news-initiative-discovery.utils";

interface PublicNewsSuggestedActionsProps {
  article: PublicNewsArticleItem;
  relatedInitiativeId?: string;
}

export function PublicNewsSuggestedActions({
  article,
  relatedInitiativeId,
}: PublicNewsSuggestedActionsProps) {
  const t = useTranslations("publicNews.card");

  return (
    <section className="public-news-card__suggested" aria-label={t("suggestedAria")}>
      <h4 className="public-news-card__section-title">{t("suggestedTitle")}</h4>
      <div className="public-news-card__suggested-grid">
        <a
          href={buildNewsSupportHref(article, relatedInitiativeId)}
          className="public-news-card__button public-news-card__button--accent"
        >
          {t("support")}
        </a>
        <a
          href={buildNewsVolunteerHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          {t("volunteer")}
        </a>
        <a
          href={buildNewsCreateProposalHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          {t("createProposal")}
        </a>
        <a
          href={buildNewsCreatePetitionHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          {t("createPetition")}
        </a>
      </div>
    </section>
  );
}
