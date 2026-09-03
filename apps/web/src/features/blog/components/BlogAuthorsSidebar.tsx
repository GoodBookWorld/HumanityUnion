"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicBlogAuthorDirectoryItem } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { fetchPublicBlogAuthors } from "../api";

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
                <Link href={publicationHref} className="blog-authors-list__latest">
                  {entry.latestPublication.title}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
