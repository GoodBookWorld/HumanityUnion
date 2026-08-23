import Link from "next/link";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogLatestMiniCardsProps {
  posts: readonly PublicBlogPostListItem[];
}

/** Pack 14D — Latest 4 mini-cards for the right discovery rail. */
export function BlogLatestMiniCards({ posts }: BlogLatestMiniCardsProps) {
  return (
    <section className="blog-rail-widget blog-latest-mini" aria-labelledby="blog-latest-mini-heading">
      <h2 id="blog-latest-mini-heading" className="hu-heading-3 blog-rail-widget__title">
        Latest Publications
      </h2>
      {posts.length === 0 ? (
        <p className="hu-caption">No publications yet.</p>
      ) : (
        <ul className="blog-latest-mini__list">
          {posts.map((post) => {
            const href = `/blog/${encodeURIComponent(post.slug)}`;
            return (
              <li key={post.postId} className="blog-latest-mini__item">
                <Link href={href} className="blog-latest-mini__link">
                  <BlogCoverImage
                    title={post.title}
                    imageUrl={post.coverImage?.mediaUrl}
                    altText={post.coverImage?.altText}
                    className="blog-latest-mini__thumb"
                  />
                  <span className="blog-latest-mini__body">
                    <span className="blog-latest-mini__title">{post.title}</span>
                    <time className="blog-latest-mini__date" dateTime={post.publishedAt}>
                      {formatBlogPublishedDate(post.publishedAt)}
                    </time>
                    <span className="blog-latest-mini__author">{post.author.displayName}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
