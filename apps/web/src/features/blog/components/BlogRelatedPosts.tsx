"use client";

import { useEffect, useState } from "react";

import type { PublicBlogPostListItem } from "@hu/types";

import { fetchPublicBlogPosts } from "../api";
import { BlogPostCard } from "./BlogPostCard";

interface BlogRelatedPostsProps {
  categoryId: string;
  excludePostId: string;
}

/**
 * Bounded same-category listing (max 3). Not AI-related; uses public Blog list API.
 */
export function BlogRelatedPosts({ categoryId, excludePostId }: BlogRelatedPostsProps) {
  const [items, setItems] = useState<PublicBlogPostListItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicBlogPosts({ categoryId, limit: 6, offset: 0, includeDiscovery: false })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setItems(
          response.items.filter((item) => item.postId !== excludePostId).slice(0, 3),
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
        More from this category
      </h2>
      <div className="blog-post-grid blog-post-grid--related">
        {items.map((post) => (
          <BlogPostCard key={post.postId} post={post} />
        ))}
      </div>
    </section>
  );
}
