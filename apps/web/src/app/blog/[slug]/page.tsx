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

    const imageUrl = resolveMediaUrl(post.coverImage?.mediaUrl);

    return {
      title: `${post.title} | Blog | Humanity Union`,
      description: post.excerpt || post.title,
      alternates: {
        canonical: `/blog/${encodeURIComponent(post.slug)}`,
      },
      openGraph: {
        title: post.title,
        description: post.excerpt || post.title,
        type: "article",
        ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
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
