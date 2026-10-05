"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicBlogAuthorDirectoryItem } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { useHuPersistedOrdinaryFields } from "../../language/use-hu-persisted-ordinary-fields";
import { fetchPublicBlogAuthors } from "../api";

function AuthorLatestPublicationTitle({
  postId,
  canonicalTitle,
}: {
  readonly postId: string;
  readonly canonicalTitle: string;
}) {
  const persisted = useHuPersistedOrdinaryFields({
    sourceKind: "blog_post",
    sourceRecordId: postId,
    fallbackFields: {
      title: canonicalTitle,
      excerpt: "",
      content: "",
    },
    fieldOrder: ["title"],
  });
  const title =
    persisted.owner === "hu-persisted" &&
    persisted.presentationMode === "localized" &&
    persisted.fields.title?.trim()
      ? persisted.fields.title
      : canonicalTitle;
  const titleLang =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.activeLanguage
      : DEFAULT_PLATFORM_LANGUAGE;
  return <span lang={titleLang}>{title}</span>;
}

/**
 * Ordinary public Blog authors rail.
 * STEP 15D.14.B.2 — latest publication title via shared blog_post hu-persisted
 * boundary (canonical fallback when localized presentation unavailable).
 */
export function BlogAuthorsSidebar() {
  const t = useTranslations("blogPublic.discovery.authors");
  const [authors, setAuthors] = useState<readonly PublicBlogAuthorDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicBlogAuthors({ limit: 40 })
      .then((response) => {
        if (!cancelled) {
          setAuthors(response.authors);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthors([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="blog-rail-widget" aria-labelledby="blog-authors-heading">
      <h2 id="blog-authors-heading" className="hu-heading-4 blog-rail-widget__title">
        {t("heading")}
      </h2>
      {loading ? <p className="hu-caption">{t("loading")}</p> : null}
      {!loading && authors.length === 0 ? <p className="hu-caption">{t("empty")}</p> : null}
      {!loading && authors.length > 0 ? (
        <ul className="blog-authors-list">
          {authors.map((entry) => {
            const profileHref = entry.author.profileUrl;
            const publicationHref = `/blog/${encodeURIComponent(entry.latestPublication.slug)}`;
            return (
              <li key={entry.latestPublication.postId} className="blog-authors-list__item">
                <div className="blog-authors-list__identity">
                  {profileHref ? (
                    <a href={profileHref} className="blog-authors-list__profile-link">
                      <HumanityAvatar avatarUrl={entry.author.avatarUrl} alt="" size={36} />
                      <span className="blog-authors-list__name">{entry.author.displayName}</span>
                    </a>
                  ) : (
                    <div className="blog-authors-list__profile-link">
                      <HumanityAvatar avatarUrl={entry.author.avatarUrl} alt="" size={36} />
                      <span className="blog-authors-list__name">{entry.author.displayName}</span>
                    </div>
                  )}
                </div>
                <p className="blog-authors-list__latest-label hu-caption">{t("latestLabel")}</p>
                <Link href={publicationHref} className="blog-authors-list__latest">
                  <AuthorLatestPublicationTitle
                    postId={entry.latestPublication.postId}
                    canonicalTitle={entry.latestPublication.title}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
