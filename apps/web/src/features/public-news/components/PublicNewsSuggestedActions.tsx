import type { PublicNewsArticleItem } from "@hu/types";

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
  return (
    <section className="public-news-card__suggested" aria-label="Suggested civic actions">
      <h4 className="public-news-card__section-title">Suggested Actions</h4>
      <div className="public-news-card__suggested-grid">
        <a
          href={buildNewsSupportHref(article, relatedInitiativeId)}
          className="public-news-card__button public-news-card__button--accent"
        >
          Support
        </a>
        <a
          href={buildNewsVolunteerHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          Volunteer
        </a>
        <a
          href={buildNewsCreateProposalHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          Create Proposal
        </a>
        <a
          href={buildNewsCreatePetitionHref(article)}
          className="public-news-card__button public-news-card__button--accent"
        >
          Create Petition
        </a>
      </div>
    </section>
  );
}
