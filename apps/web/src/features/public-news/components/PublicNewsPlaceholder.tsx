"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";

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
        <h3>{t("errorTitle")}</h3>
        <p>{t("errorBody")}</p>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === "no-results") {
    return (
      <div className="public-news-discovery__placeholder" role="status">
        <h3>{t("noResultsTitle")}</h3>
        <p>{message ?? t("noResultsBody")}</p>
      </div>
    );
  }

  return (
    <div className="public-news-discovery__placeholder" role="status">
      <h3>{t("emptyTitle")}</h3>
      <p>{t("emptyBody")}</p>
    </div>
  );
}
