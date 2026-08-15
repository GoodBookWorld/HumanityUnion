import Link from "next/link";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogPostCardProps {
  post: PublicBlogPostListItem;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const titleId = `blog-card-title-${post.postId}`;

  return (
    <article className="hu-card blog-post-card" aria-labelledby={titleId}>
      <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="blog-post-card__media-link">
        <BlogCoverImage
          title={post.title}
          imageUrl={post.coverImage?.mediaUrl}
          className="blog-post-card__image"
        />
      </Link>
      <div className="blog-post-card__body">
        <p className="hu-caption blog-post-card__category">{post.category.name}</p>
        <h2 id={titleId} className="hu-heading-3 blog-post-card__title">
          <Link href={`/blog/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
        </h2>
        <p className="hu-body-sm blog-post-card__excerpt">{post.excerpt}</p>
        <div className="blog-post-card__meta">
          <BlogAuthorInline author={post.author} />
          <time className="hu-caption" dateTime={post.publishedAt}>
            {formatBlogPublishedDate(post.publishedAt)}
          </time>
          {post.commentCount > 0 ? (
            <span className="hu-caption">
              {post.commentCount === 1 ? "1 comment" : `${post.commentCount} comments`}
            </span>
          ) : null}
        </div>
        <Link
          href={`/blog/${encodeURIComponent(post.slug)}`}
          className="blog-post-card__read"
        >
          Read Article
        </Link>
      </div>
    </article>
  );
}
