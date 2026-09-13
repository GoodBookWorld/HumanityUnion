import type { Metadata } from "next";

import { fetchPublicBlogPostBySlugOptional } from "../../../features/blog/api";
import { BlogArticlePageContent } from "../../../features/blog/components/BlogArticlePageContent";
import { loadBlogArticlePresentationSeed } from "../../../features/blog/load-blog-article-presentation-seed";
import { resolveBlogServerSeedReadingPolicy } from "../../../features/blog/resolve-blog-server-seed-reading-policy";
import { resolveDocumentHtmlLocale } from "../../../features/language/resolve-document-locale";
import { resolveMediaUrl } from "../../../features/media-upload/media-url";
import { buildPublicPageMetadataForRequest } from "../../../lib/seo/build-public-page-metadata-for-request";
import { loadBlogMetadataTranslationFields } from "../../../lib/seo/load-blog-metadata-translation-fields";
import { resolveLocalizedPublicMetadataCopy } from "../../../lib/seo/resolve-localized-public-metadata-copy";
import { JsonLdScript, buildBlogPostingJsonLd } from "../../../lib/seo/structured-data";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Step 07C.3 — request-aware canonical/hreflang.
 * Step 07D — optional compact blog_post CT overlay for title/excerpt (GET resolve only).
 */
export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await fetchPublicBlogPostBySlugOptional(slug);

    if (!post) {
      const localeFreeCanonicalPath = `/blog/${encodeURIComponent(slug)}`;
      return buildPublicPageMetadataForRequest({
        title: "Publication not found",
        titleBrandSuffix: "Blog | Humanity Union",
        canonicalPath: localeFreeCanonicalPath,
        localeFreeCanonicalPath,
        indexable: false,
      });
    }

    const seo = post.seo;
    const imageUrl = resolveMediaUrl(seo?.socialImage?.mediaUrl ?? post.coverImage?.mediaUrl);
    const pageTitle = seo?.title || post.title;
    const description = seo?.description || post.excerpt || post.title;
    const localeFreeCanonicalPath =
      seo?.canonicalPath || `/blog/${encodeURIComponent(post.slug)}`;

    const documentLocale = await resolveDocumentHtmlLocale();
    const translationFields = await loadBlogMetadataTranslationFields({
      postId: post.postId,
      language: documentLocale.locale,
    });
    const localized = resolveLocalizedPublicMetadataCopy({
      title: pageTitle,
      description,
      locale: documentLocale.locale,
      translatedTitle: translationFields.translatedTitle,
      translatedDescription: translationFields.translatedDescription,
    });

    // Explicit Admin/Blog SEO social fields stay authoritative when set.
    const socialTitle = seo?.socialTitle || localized.title;
    const socialDescription = seo?.socialDescription || localized.description;

    return buildPublicPageMetadataForRequest({
      title: localized.title,
      titleBrandSuffix: "Blog | Humanity Union",
      description: localized.description,
      canonicalPath: localeFreeCanonicalPath,
      localeFreeCanonicalPath,
      socialTitle,
      socialDescription,
      imageUrl,
      openGraphType: "article",
    });
  } catch {
    return buildPublicPageMetadataForRequest({
      title: "Blog",
      titleBrandSuffix: "Humanity Union",
      canonicalPath: "/blog",
      localeFreeCanonicalPath: "/blog",
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

  // Pack 08I.8 / 08I.10 — SSR seed from warm content_translations (GET only).
  // Authenticated explicit `none` → canonical seed (no warm overlay).
  let initialPresentation:
    | { title: string; excerpt: string; contentHtml: string }
    | undefined;
  if (initialPost) {
    const readingPolicy = await resolveBlogServerSeedReadingPolicy();
    initialPresentation = await loadBlogArticlePresentationSeed({
      postId: initialPost.postId,
      language: readingPolicy.language,
      preferTranslation: readingPolicy.preferTranslation,
      canonical: {
        title: initialPost.title,
        excerpt: initialPost.excerpt,
        contentHtml: initialPost.content,
      },
    });
  }

  const structuredData =
    initialPost == null
      ? null
      : buildBlogPostingJsonLd({
          headline: initialPresentation?.title || initialPost.seo?.title || initialPost.title,
          description:
            initialPresentation?.excerpt ||
            initialPost.seo?.description ||
            initialPost.excerpt ||
            initialPost.title,
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
      <BlogArticlePageContent
        slug={slug}
        initialPost={initialPost}
        initialPresentation={initialPresentation}
      />
    </>
  );
}
