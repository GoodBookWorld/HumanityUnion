import Link from "next/link";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogPostCardProps {
  post: PublicBlogPostListItem;
}

function commentsLabel(count: number): string {
  if (count <= 0) {
    return "No Comments";
  }
  if (count === 1) {
    return "1 Comment";
  }
  return `${count} Comments`;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const titleId = `blog-card-title-${post.postId}`;
  const href = `/blog/${encodeURIComponent(post.slug)}`;
  const commentsHref = `${href}#comments`;
  const categoryHref = buildBlogIndexHref({ categorySlug: post.category.slug });

  return (
    <article className="hu-card blog-post-card" aria-labelledby={titleId}>
      <div className="blog-post-card__body">
        <h2 id={titleId} className="hu-heading-3 blog-post-card__title">
          <Link href={href}>{post.title}</Link>
        </h2>

        <div className="blog-post-card__meta" aria-label="Publication details">
          <span className="blog-post-card__meta-item">
            <img
              src="/icons/workspace/date.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <time dateTime={post.publishedAt}>{formatBlogPublishedDate(post.publishedAt)}</time>
          </span>

          <span className="blog-post-card__meta-item blog-post-card__meta-item--author">
            <BlogAuthorInline author={post.author} />
          </span>

          <Link href={commentsHref} className="blog-post-card__meta-item blog-post-card__meta-link">
            <img
              src="/icons/workspace/comments.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <span>{commentsLabel(post.commentCount)}</span>
          </Link>
        </div>

        <div className="blog-post-card__content">
          <Link href={href} className="blog-post-card__media-link" tabIndex={-1} aria-hidden="true">
            <BlogCoverImage
              title={post.title}
              imageUrl={post.coverImage?.mediaUrl}
              altText={post.coverImage?.altText}
              className="blog-post-card__image"
            />
          </Link>
          <p className="hu-body-sm blog-post-card__excerpt">{post.excerpt}</p>
        </div>

        <p className="blog-post-card__category">
          <Link href={categoryHref} className="blog-post-card__category-link">
            <img
              src="/icons/workspace/opened-folder.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <span>{post.category.name}</span>
          </Link>
        </p>
      </div>
    </article>
  );
}
