"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { BlogAuthorWorkspacePostSummary, BlogPostStatus } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { listOwnBlogPosts } from "../publishing-api";
import { PublicationListItem } from "./PublicationListItem";

type PublishingTab = "draft" | "submitted_for_review" | "scheduled" | "published" | "archived";

const TAB_IDS: readonly PublishingTab[] = [
  "draft",
  "submitted_for_review",
  "scheduled",
  "published",
  "archived",
];

export interface PublishingDashboardProps {
  canDirectPublish: boolean;
  /** Pack 13B/16A — Author soft-block disables Edit/Correct/Delete. */
  mutationsDisabled?: boolean;
}

export function PublishingDashboard({
  canDirectPublish,
  mutationsDisabled = false,
}: PublishingDashboardProps) {
  const t = useTranslations("workspace.publishingPage");
  const [tab, setTab] = useState<PublishingTab>("draft");
  const [items, setItems] = useState<BlogAuthorWorkspacePostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (status: BlogPostStatus) => {
      setLoading(true);
      setError(null);
      try {
        const response = await listOwnBlogPosts({ status, limit: 50 });
        setItems([...response.items]);
      } catch (loadError) {
        if (isAuthenticationRequiredError(loadError)) {
          setError(t("signInManage"));
        } else {
          setError(formatAuthFormError(loadError));
        }
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  return (
    <div className="publishing-dashboard">
      <div className="publishing-dashboard__header">
        <Button href="/workspace/publishing/new" variant="primary" disabled={mutationsDisabled}>
          {t("newPublication")}
        </Button>
      </div>

      {mutationsDisabled ? (
        <StatusBanner title={t("actionsUnavailableTitle")} message={t("actionsUnavailableBody")} />
      ) : null}

      <div className="publishing-dashboard__tabs" role="tablist" aria-label={t("tabsAria")}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`hu-tab-control publishing-dashboard__tab${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {error ? <StatusBanner title={t("loadErrorTitle")} message={error} /> : null}

      {loading ? <p className="hu-body">{t("loading")}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="hu-body publishing-dashboard__empty">{t(`empty.${tab}`)}</p>
      ) : null}

      <ul className="publishing-dashboard__list">
        {items.map((post) => (
          <li key={post.postId}>
            <PublicationListItem
              post={post}
              canDirectPublish={canDirectPublish}
              mutationsDisabled={mutationsDisabled}
              onMutated={() => void load(tab)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
