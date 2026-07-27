"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readNewsBookmarkIds,
  writeNewsBookmarkIds,
} from "../public-news-initiative-discovery.utils";

export function usePublicNewsBookmarks() {
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  useEffect(() => {
    setBookmarkedIds(readNewsBookmarkIds());
  }, []);

  const isBookmarked = useCallback(
    (newsId: string) => bookmarkedIds.includes(newsId),
    [bookmarkedIds],
  );

  const toggleBookmark = useCallback((newsId: string) => {
    setBookmarkedIds((current) => {
      const next = current.includes(newsId)
        ? current.filter((id) => id !== newsId)
        : [...current, newsId];

      writeNewsBookmarkIds(next);
      return next;
    });
  }, []);

  return {
    isBookmarked,
    toggleBookmark,
  };
}
