"use client";

import { useEffect, useState } from "react";

import type { BlogEditorialQueueItem, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { listEditorialReviewQueue } from "../editorial-api";

function categoryName(categoryId: BlogCategoryId): string {
  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}

function safetyLabel(outcome: BlogEditorialQueueItem["safetyOutcome"]): string {
  if (!outcome) {
    return "Safety: not evaluated";
  }
  return `Safety: ${outcome}`;
}

function editorialLabel(item: BlogEditorialQueueItem): string {
  return `Editorial: ${item.review.reviewStatus}`;
}

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

export function EditorialQueuePageContent() {
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
          setError("Sign in to open Editorial Review.");
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("Editorial Review is available to Editors and Administrators only.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <StatusBanner
        title={denied ? "Access restricted" : "Editorial Review unavailable"}
        message={error}
      />
    );
  }

  if (!items) {
    return <p className="hu-body">Loading review queue…</p>;
  }

  return (
    <section aria-labelledby="editorial-pending-heading">
      <h2 id="editorial-pending-heading" className="hu-heading-2">
        Pending Review
      </h2>
      <p className="hu-body">
        Submitted Blog publications awaiting editorial attention. Oldest submissions appear first.
      </p>

      {items.length === 0 ? (
        <p className="editorial-queue__empty hu-body">No publications are waiting for review.</p>
      ) : (
        <ul className="editorial-queue__list">
          {items.map((item) => (
            <li key={item.postId}>
              <Card className="editorial-queue-item">
                <h3 className="hu-heading-3">{item.title}</h3>
                <div className="editorial-queue-item__meta hu-caption">
                  <span>Author: {item.authorDisplayName}</span>
                  <span>Submitted {formatDate(item.submittedAt)}</span>
                  <span>{categoryName(item.categoryId)}</span>
                  <span>{safetyLabel(item.safetyOutcome)}</span>
                  <span>{editorialLabel(item)}</span>
                  <span>Updated {formatDate(item.updatedAt)}</span>
                </div>
                <div className="editorial-queue-item__actions hu-form-actions">
                  <Button href={`/workspace/editorial/${item.postId}`} variant="primary">
                    Open review
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
