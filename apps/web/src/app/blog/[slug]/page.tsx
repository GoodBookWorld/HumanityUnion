import type { Metadata } from "next";

import { fetchPublicBlogPostBySlugOptional } from "../../../features/blog/api";
import { BlogArticlePageContent } from "../../../features/blog/components/BlogArticlePageContent";
import { resolveMediaUrl } from "../../../features/media-upload/media-url";

interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await fetchPublicBlogPostBySlugOptional(slug);

    if (!post) {
      return {
        title: "Publication not found | Blog | Humanity Union",
      };
    }

    const seo = post.seo;
    const imageUrl = resolveMediaUrl(seo?.socialImage?.mediaUrl ?? post.coverImage?.mediaUrl);
    const pageTitle = seo?.title || post.title;
    const description = seo?.description || post.excerpt || post.title;
    const socialTitle = seo?.socialTitle || pageTitle;
    const socialDescription = seo?.socialDescription || description;
    const canonical = seo?.canonicalPath || `/blog/${encodeURIComponent(post.slug)}`;

    return {
      title: `${pageTitle} | Blog | Humanity Union`,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        title: socialTitle,
        description: socialDescription,
        type: "article",
        url: canonical,
        ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title: socialTitle,
        description: socialDescription,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    return {
      title: "Blog | Humanity Union",
    };
  }
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  // Launch Readiness Pack 06 — share one detail fetch with the client tree.
  // Note: generateMetadata may fetch separately in Next; this still removes the
  // additional client-side refetch that previously always ran after hydration.
  const initialPost = await fetchPublicBlogPostBySlugOptional(slug);

  return <BlogArticlePageContent slug={slug} initialPost={initialPost} />;
}
