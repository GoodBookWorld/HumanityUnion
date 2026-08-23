"use client";

import { useEffect, useState } from "react";

import type {
  BlogCategory,
  PublicBlogCategoryCount,
  PublicBlogPostListItem,
} from "@hu/types";

import { fetchPublicBlogCategories, fetchPublicBlogPosts } from "../api";

export interface PublicBlogDiscoveryState {
  categories: readonly BlogCategory[];
  categoryCounts: readonly PublicBlogCategoryCount[];
  latestPublications: readonly PublicBlogPostListItem[];
  blogIndexViews: number;
}

const EMPTY_DISCOVERY: PublicBlogDiscoveryState = {
  categories: [],
  categoryCounts: [],
  latestPublications: [],
  blogIndexViews: 0,
};

/**
 * Pack 14E — shared discovery payload for `/blog` and `/blog/{slug}` shells.
 * Uses the Pack 14D public list endpoint with `includeDiscovery` (pageSize 1).
 */
export function usePublicBlogDiscovery(): PublicBlogDiscoveryState {
  const [state, setState] = useState<PublicBlogDiscoveryState>(EMPTY_DISCOVERY);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      fetchPublicBlogCategories().catch(() => [] as BlogCategory[]),
      fetchPublicBlogPosts({
        page: 1,
        pageSize: 1,
        includeDiscovery: true,
        signal: controller.signal,
      }).catch(() => null),
    ]).then(([categories, response]) => {
      if (controller.signal.aborted) {
        return;
      }

      setState({
        categories,
        categoryCounts: response?.categoryCounts ?? [],
        latestPublications: response?.latestPublications ?? [],
        blogIndexViews: response?.blogIndexViews ?? 0,
      });
    });

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
