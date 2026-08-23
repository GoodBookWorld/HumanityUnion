"use client";

import { useCallback, useEffect, useState } from "react";

import type { BlogAuthorWorkspacePostSummary, BlogPostStatus } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { listOwnBlogPosts } from "../publishing-api";
import { PublicationListItem } from "./PublicationListItem";

type PublishingTab = "draft" | "submitted_for_review" | "scheduled" | "published" | "archived";

const TABS: readonly { id: PublishingTab; label: string; empty: string }[] = [
  {
    id: "draft",
    label: "Drafts",
    empty: "No draft publications yet.",
  },
  {
    id: "submitted_for_review",
    label: "Under Review",
    empty: "No publications are currently under review.",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    empty: "No scheduled publications.",
  },
  {
    id: "published",
    label: "Published",
    empty: "No published Blog articles yet.",
  },
  {
    id: "archived",
    label: "Archived",
    empty: "No archived publications.",
  },
];

export interface PublishingDashboardProps {
  canDirectPublish: boolean;
}

export function PublishingDashboard({ canDirectPublish }: PublishingDashboardProps) {
  const [tab, setTab] = useState<PublishingTab>("draft");
  const [items, setItems] = useState<BlogAuthorWorkspacePostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: BlogPostStatus) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listOwnBlogPosts({ status, limit: 50 });
      setItems([...response.items]);
    } catch (loadError) {
      if (isAuthenticationRequiredError(loadError)) {
        setError("Sign in to manage your publications.");
      } else {
        setError(formatAuthFormError(loadError));
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [load, tab]);

  const activeTab = TABS.find((entry) => entry.id === tab) ?? TABS[0]!;

  return (
    <div className="publishing-dashboard">
      <div className="publishing-dashboard__header">
        <Button href="/workspace/publishing/new" variant="primary">
          New Publication
        </Button>
      </div>

      <div className="publishing-dashboard__tabs" role="tablist" aria-label="Publication status">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`publishing-dashboard__tab${tab === entry.id ? " is-active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error ? <StatusBanner title="Unable to load publications" message={error} /> : null}

      {loading ? <p className="hu-body">Loading publications…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="hu-body publishing-dashboard__empty">{activeTab.empty}</p>
      ) : null}

      <ul className="publishing-dashboard__list">
        {items.map((post) => (
          <li key={post.postId}>
            <PublicationListItem post={post} canDirectPublish={canDirectPublish} />
          </li>
        ))}
      </ul>
    </div>
  );
}
