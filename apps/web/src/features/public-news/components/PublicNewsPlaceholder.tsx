"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { MediaSemanticNode } from "../../language/media-plp/media-semantic-contract";

interface PublicNewsPlaceholderProps {
  variant: "loading" | "empty" | "error" | "no-results";
  onRetry?: () => void;
  message?: string;
}

export function PublicNewsPlaceholder({ variant, onRetry, message }: PublicNewsPlaceholderProps) {
  const t = useTranslations("publicNews.placeholder");

  if (variant === "loading") {
    return (
      <div
        className="public-news-discovery__skeleton-grid"
        role="status"
        aria-label={t("loadingAria")}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="public-news-discovery__skeleton-card" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="public-news-discovery__status" role="alert">
        <MediaSemanticNode as="h3" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {t("errorTitle")}
        </MediaSemanticNode>
        <MediaSemanticNode as="p" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {t("errorBody")}
        </MediaSemanticNode>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
              {t("retry")}
            </MediaSemanticNode>
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === "no-results") {
    return (
      <div className="public-news-discovery__placeholder" role="status">
        <MediaSemanticNode as="h3" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {t("noResultsTitle")}
        </MediaSemanticNode>
        <MediaSemanticNode as="p" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {message ?? t("noResultsBody")}
        </MediaSemanticNode>
      </div>
    );
  }

  return (
    <div className="public-news-discovery__placeholder" role="status">
      <MediaSemanticNode as="h3" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
        {t("emptyTitle")}
      </MediaSemanticNode>
      <MediaSemanticNode as="p" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
        {t("emptyBody")}
      </MediaSemanticNode>
    </div>
  );
}
