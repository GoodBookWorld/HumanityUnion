"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";

import { fetchPublicBlogPosts } from "../api";
import { BlogPostCard } from "./BlogPostCard";

interface BlogRelatedPostsProps {
  categoryId: string;
  excludePostId: string;
}

/** Same-category related strip: desktop shows 2 cards; extras scroll horizontally. */
export function BlogRelatedPosts({ categoryId, excludePostId }: BlogRelatedPostsProps) {
  const t = useTranslations("blogPublic.discovery.related");
  const [items, setItems] = useState<PublicBlogPostListItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicBlogPosts({ categoryId, limit: 12, offset: 0, includeDiscovery: false })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setItems(
          response.items.filter((item) => item.postId !== excludePostId).slice(0, 8),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, excludePostId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="blog-related" aria-labelledby="blog-related-heading">
      <h2 id="blog-related-heading" className="hu-heading-2">
        {t("heading")}
      </h2>
      <div className="blog-post-grid blog-post-grid--related" tabIndex={0}>
        {items.map((post) => (
          <BlogPostCard key={post.postId} post={post} layout="related" />
        ))}
      </div>
    </section>
  );
}
