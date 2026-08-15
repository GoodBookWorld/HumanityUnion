"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  AuthUserPublic,
  BlogEditorialQueueItem,
  PublicBlogPostListItem,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Card } from "../../../design-system/components/Card";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { fetchPublicBlogPosts, formatBlogPublishedDate } from "../../blog/api";
import { listEditorialReviewQueue } from "../../blog/editorial-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminPublishingSectionProps {
  user: AuthUserPublic;
}

export function AdminPublishingSection({ user: _user }: AdminPublishingSectionProps) {
  const [queueItems, setQueueItems] = useState<readonly BlogEditorialQueueItem[] | null>(null);
  const [queueTotal, setQueueTotal] = useState<number | null>(null);
  const [published, setPublished] = useState<readonly PublicBlogPostListItem[] | null>(null);
  const [publishedTotal, setPublishedTotal] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      listEditorialReviewQueue({ limit: 20, offset: 0 }),
      fetchPublicBlogPosts({ limit: 12, offset: 0 }),
    ]).then(([queueResult, publishedResult]) => {
      if (cancelled) {
        return;
      }

      if (queueResult.status === "fulfilled") {
        setQueueItems(queueResult.value.items);
        setQueueTotal(queueResult.value.total);
        setQueueError(null);
      } else {
        setQueueItems(null);
        setQueueTotal(null);
        setQueueError(formatAuthFormError(queueResult.reason));
      }

      if (publishedResult.status === "fulfilled") {
        setPublished(publishedResult.value.items);
        setPublishedTotal(publishedResult.value.total);
        setPublishedError(null);
      } else {
        setPublished(null);
        setPublishedTotal(null);
        setPublishedError(formatAuthFormError(publishedResult.reason));
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Publishing summary">
        {loading ? <p className="hu-body">Loading publishing surfaces…</p> : null}
        <ProfileField
          label="Editorial queue total"
          value={queueTotal === null ? "Unavailable" : String(queueTotal)}
        />
        <ProfileField
          label="Published Blog posts"
          value={publishedTotal === null ? "Unavailable" : String(publishedTotal)}
        />
        <p className="hu-caption admin-panel__note">
          Correction and publish decisions use the existing Editorial Review workflow — not a
          parallel Admin publishing system.
        </p>
        <ul className="admin-panel__links">
          <li>
            <Link className="admin-panel__link" href="/workspace/editorial">
              Open Editorial Review
            </Link>
          </li>
          <li>
            <Link className="admin-panel__link" href="/blog">
              Open public Blog
            </Link>
          </li>
        </ul>
      </ProfileSection>

      <ProfileSection title="Editorial queue">
        {queueError ? <StatusBanner title="Editorial queue unavailable" message={queueError} /> : null}
        {queueItems && queueItems.length === 0 ? (
          <p className="hu-body">No publications are waiting for review.</p>
        ) : null}
        {queueItems && queueItems.length > 0 ? (
          <ul className="admin-panel__entity-list">
            {queueItems.map((item) => (
              <li key={item.postId}>
                <Card className="admin-panel__entity-card">
                  <p className="hu-body admin-panel__entity-title">
                    <Link
                      className="admin-panel__link"
                      href={`/workspace/editorial/${encodeURIComponent(item.postId)}`}
                    >
                      {item.title}
                    </Link>
                  </p>
                  <p className="hu-caption">
                    Review: {item.review.reviewStatus}
                    {item.safetyOutcome ? ` · Safety: ${item.safetyOutcome}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Published posts">
        {publishedError ? (
          <StatusBanner title="Published Blog unavailable" message={publishedError} />
        ) : null}
        {published && published.length === 0 ? (
          <p className="hu-body">No published Blog posts found.</p>
        ) : null}
        {published && published.length > 0 ? (
          <ul className="admin-panel__entity-list">
            {published.map((post) => (
              <li key={post.postId}>
                <Card className="admin-panel__entity-card">
                  <p className="hu-body admin-panel__entity-title">
                    <Link className="admin-panel__link" href={`/blog/${encodeURIComponent(post.slug)}`}>
                      {post.title}
                    </Link>
                  </p>
                  <p className="hu-caption">
                    Published: {formatBlogPublishedDate(post.publishedAt)} · slug: {post.slug}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </ProfileSection>
    </div>
  );
}
