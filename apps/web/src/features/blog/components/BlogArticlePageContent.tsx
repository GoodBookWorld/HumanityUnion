"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { PublicBlogPostDetail } from "@hu/types";

import { isApiUnavailableError, isNotFoundError } from "../../../lib/api-client";
import { formatBlogPublishedDate, fetchPublicBlogPostBySlug } from "../api";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogAuthorCard } from "./BlogAuthorCard";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCommentsSection } from "./BlogCommentsSection";
import { BlogCoverImage } from "./BlogCoverImage";
import { BlogReactionControls } from "./BlogReactionControls";
import { BlogRelatedPosts } from "./BlogRelatedPosts";

import "../blog.css";

interface BlogArticlePageContentProps {
  slug: string;
  /**
   * Launch Readiness Pack 06 — when provided by the server page (including
   * `null` for not-found), the client skips a duplicate detail fetch.
   */
  initialPost?: PublicBlogPostDetail | null;
}

/**
 * Previous/Next neighbour navigation is deferred: the public Blog API does not
 * yet expose neighbouring posts. Do not fetch the full corpus client-side.
 */
export function BlogArticlePageContent({ slug, initialPost }: BlogArticlePageContentProps) {
  const seeded = initialPost !== undefined;
  const [post, setPost] = useState<PublicBlogPostDetail | null>(() =>
    initialPost && initialPost.slug === slug ? initialPost : null,
  );
  const [error, setError] = useState<"not_found" | "unavailable" | "generic" | null>(() =>
    seeded && initialPost === null ? "not_found" : null,
  );

  useEffect(() => {
    if (seeded) {
      if (initialPost && initialPost.slug === slug) {
        setPost(initialPost);
        setError(null);
        return;
      }

      setPost(null);
      setError("not_found");
      return;
    }

    let cancelled = false;
    setPost(null);
    setError(null);

    void fetchPublicBlogPostBySlug(slug)
      .then((detail) => {
        if (!cancelled) {
          setPost(detail);
        }
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }

        if (isNotFoundError(fetchError)) {
          setError("not_found");
          return;
        }

        if (isApiUnavailableError(fetchError)) {
          setError("unavailable");
          return;
        }

        setError("generic");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, seeded, initialPost]);

  if (error === "not_found") {
    return (
      <main className="blog-article hu-page-container">
        <p className="hu-body" role="alert">
          This publication could not be found.
        </p>
        <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
          Back to Blog
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="blog-article hu-page-container">
        <p className="hu-body" role="alert">
          {error === "unavailable"
            ? "The Blog is temporarily unavailable. Please try again shortly."
            : "Unable to load this publication."}
        </p>
        <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
          Back to Blog
        </Link>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="blog-article hu-page-container">
        <p className="blog-page__status">Loading publication…</p>
      </main>
    );
  }

  const showUpdated =
    post.updatedAt &&
    post.publishedAt &&
    Date.parse(post.updatedAt) - Date.parse(post.publishedAt) > 60_000;

  return (
    <main className="blog-article hu-page-container">
      <nav className="blog-article__crumb" aria-label="Breadcrumb">
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true"> / </span>
        <span>{post.category.name}</span>
      </nav>

      <p className="hu-caption blog-article__category">{post.category.name}</p>
      <h1 className="hu-heading-1 blog-article__title">{post.title}</h1>

      <div className="blog-article__meta">
        <BlogAuthorInline author={post.author} />
        <time className="hu-caption" dateTime={post.publishedAt}>
          {formatBlogPublishedDate(post.publishedAt)}
        </time>
        {showUpdated ? (
          <time className="hu-caption" dateTime={post.updatedAt}>
            Updated {formatBlogPublishedDate(post.updatedAt)}
          </time>
        ) : null}
      </div>

      <div className="blog-article__cover">
        <BlogCoverImage
          title={post.title}
          imageUrl={post.coverImage?.mediaUrl}
          altText={post.coverImage?.altText}
          className="blog-article__cover-image"
          priority
        />
      </div>

      <BlogArticleBody html={post.content} />

      {/*
        Translation: Blog body is sanitized HTML. Existing TranslatedContentView
        targets plain text fields. Until HTML-aware presentation exists, the
        canonical original article is shown. Language Architecture already
        registers sourceKind blog_post for future packs.
      */}

      <BlogReactionControls
        slug={post.slug}
        initialHelpful={post.reactionCounts.helpful}
        initialNotHelpful={post.reactionCounts.notHelpful}
        initialCurrent={post.currentUserReaction}
      />

      <BlogCommentsSection slug={post.slug} initialCount={post.commentCount} />

      <BlogAuthorCard author={post.author} />

      <BlogRelatedPosts categoryId={post.category.categoryId} excludePostId={post.postId} />

      <p className="blog-article__back">
        <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
          Back to Blog
        </Link>
      </p>
    </main>
  );
}
