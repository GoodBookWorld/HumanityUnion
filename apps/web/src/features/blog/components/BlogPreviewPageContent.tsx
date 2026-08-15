"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isNotFoundError,
} from "../../../lib/api-client";
import { formatBlogPublishedDate } from "../api";
import { previewBlogPost, type BlogPreviewProjection } from "../publishing-api";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogAuthorCard } from "./BlogAuthorCard";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

import "../blog.css";

export function BlogPreviewPageContent({ postId }: { postId: string }) {
  const [post, setPost] = useState<BlogPreviewProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void previewBlogPost(postId)
      .then((preview) => {
        if (!cancelled) {
          setPost(preview);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to preview this publication.");
        } else if (isNotFoundError(loadError)) {
          setError("Preview not available.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (error) {
    return <StatusBanner title="Preview unavailable" message={error} />;
  }

  if (!post) {
    return <p className="hu-body">Loading preview…</p>;
  }

  return (
    <main className="blog-article hu-page-container blog-preview">
      <StatusBanner
        title="Draft Preview — Not Published"
        message="This private preview does not change status or publish the article."
      />

      <p className="hu-caption blog-article__category">{post.category.name}</p>
      <h1 className="hu-heading-1 blog-article__title">{post.title}</h1>

      <div className="blog-article__meta">
        <BlogAuthorInline author={post.author} />
        {post.publishedAt ? (
          <time className="hu-caption" dateTime={post.publishedAt}>
            {formatBlogPublishedDate(post.publishedAt)}
          </time>
        ) : (
          <span className="hu-caption">Not published</span>
        )}
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
      <BlogAuthorCard author={post.author} />

      <p className="blog-article__back hu-form-actions">
        <Link
          href={`/workspace/publishing/${post.postId}`}
          className="hu-button hu-button--primary hu-button--sm"
        >
          Back to Editor
        </Link>
        <Link href="/workspace/publishing" className="hu-button hu-button--secondary hu-button--sm">
          Publishing
        </Link>
      </p>
    </main>
  );
}
