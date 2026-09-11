"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { BlogEditorialQueueItem } from "@hu/types";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import {
  resolveEditorialReviewStatusLabel,
  resolveEditorialSafetyOutcomeLabel,
} from "../blog-workspace-i18n";
import { listEditorialReviewQueue } from "../editorial-api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";

import "../editorial.css";

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function EditorialQueueBody() {
  const t = useTranslations("workspace.editorialPage");
  const tBlog = useTranslations("blogPublic");
  const [items, setItems] = useState<readonly BlogEditorialQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listEditorialReviewQueue()
      .then((response) => {
        if (!cancelled) {
          setItems(response.items);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(loadError)) {
          setError(t("signIn"));
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError(t("accessRestrictedBody"));
        } else {
          setError(formatAuthFormError(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return (
      <StatusBanner
        title={denied ? t("accessRestrictedTitle") : t("unavailableTitle")}
        message={error}
      />
    );
  }

  if (!items) {
    return <p className="hu-body">{t("loadingQueue")}</p>;
  }

  return (
    <section aria-labelledby="editorial-pending-heading">
      <h2 id="editorial-pending-heading" className="hu-heading-2">
        {t("pendingHeading")}
      </h2>
      <p className="hu-body">{t("pendingIntro")}</p>

      {items.length === 0 ? (
        <p className="editorial-queue__empty hu-body">{t("empty")}</p>
      ) : (
        <ul className="editorial-queue__list">
          {items.map((item) => {
            const safetyOutcome = resolveEditorialSafetyOutcomeLabel(item.safetyOutcome, t);
            const reviewStatus = resolveEditorialReviewStatusLabel(item.review.reviewStatus, t);
            return (
              <li key={item.postId}>
                <Card className="editorial-queue-item">
                  <h3 className="hu-heading-3">{item.title}</h3>
                  <div className="editorial-queue-item__meta hu-caption">
                    <span>
                      {t("author")}: {item.authorDisplayName}
                    </span>
                    <span>{t("submitted", { date: formatDate(item.submittedAt) })}</span>
                    <span>{resolveBlogCategoryDisplayName(item.categoryId, tBlog)}</span>
                    <span>{t("safetyLabel", { outcome: safetyOutcome })}</span>
                    <span>{t("editorialLabel", { status: reviewStatus })}</span>
                    <span>{t("updated", { date: formatDate(item.updatedAt) })}</span>
                  </div>
                  <div className="editorial-queue-item__actions hu-form-actions">
                    <Button href={`/workspace/editorial/${item.postId}`} variant="primary">
                      {t("openReview")}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function EditorialWorkspacePage() {
  const t = useTranslations("workspace.editorialPage");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle")}
        workspaceNavigation={<WorkspaceNavigation />}
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description={t("assistantDescription")}
          />
        }
      >
        <EditorialQueueBody />
      </MemberWorkspace>
    </main>
  );
}

/** @deprecated Prefer EditorialWorkspacePage for localized chrome. */
export function EditorialQueuePageContent() {
  return <EditorialQueueBody />;
}
