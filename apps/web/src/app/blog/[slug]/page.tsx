import type { Metadata } from "next";

import { fetchPublicBlogPostBySlugOptional } from "../../../features/blog/api";
import { BlogArticlePageContent } from "../../../features/blog/components/BlogArticlePageContent";
import { resolveMediaUrl } from "../../../features/media-upload/media-url";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import { JsonLdScript, buildBlogPostingJsonLd } from "../../../lib/seo/structured-data";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await fetchPublicBlogPostBySlugOptional(slug);

    if (!post) {
      return buildPublicPageMetadata({
        title: "Publication not found",
        titleBrandSuffix: "Blog | Humanity Union",
        canonicalPath: `/blog/${encodeURIComponent(slug)}`,
        indexable: false,
      });
    }

    const seo = post.seo;
    const imageUrl = resolveMediaUrl(seo?.socialImage?.mediaUrl ?? post.coverImage?.mediaUrl);
    const pageTitle = seo?.title || post.title;
    const description = seo?.description || post.excerpt || post.title;
    const socialTitle = seo?.socialTitle || pageTitle;
    const socialDescription = seo?.socialDescription || description;
    const canonical = seo?.canonicalPath || `/blog/${encodeURIComponent(post.slug)}`;

    return buildPublicPageMetadata({
      title: pageTitle,
      titleBrandSuffix: "Blog | Humanity Union",
      description,
      canonicalPath: canonical,
      socialTitle,
      socialDescription,
      imageUrl,
      openGraphType: "article",
    });
  } catch {
    return buildPublicPageMetadata({
      title: "Blog",
      titleBrandSuffix: "Humanity Union",
      canonicalPath: "/blog",
      indexable: false,
    });
  }
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  // Launch Readiness Pack 06 — share one detail fetch with the client tree.
  // Note: generateMetadata may fetch separately in Next; this still removes the
  // additional client-side refetch that previously always ran after hydration.
  const initialPost = await fetchPublicBlogPostBySlugOptional(slug);

  const structuredData =
    initialPost == null
      ? null
      : buildBlogPostingJsonLd({
          headline: initialPost.seo?.title || initialPost.title,
          description: initialPost.seo?.description || initialPost.excerpt || initialPost.title,
          canonicalPath:
            initialPost.seo?.canonicalPath || `/blog/${encodeURIComponent(initialPost.slug)}`,
          imageUrl: resolveMediaUrl(
            initialPost.seo?.socialImage?.mediaUrl ?? initialPost.coverImage?.mediaUrl,
          ),
          datePublished: initialPost.publishedAt,
          dateModified: initialPost.updatedAt,
          author: {
            name: initialPost.author.displayName,
            profilePathOrUrl: initialPost.author.profileUrl,
            avatarUrl: resolveMediaUrl(initialPost.author.avatarUrl),
          },
        });

  return (
    <>
      <JsonLdScript data={structuredData} />
      <BlogArticlePageContent slug={slug} initialPost={initialPost} />
    </>
  );
}
