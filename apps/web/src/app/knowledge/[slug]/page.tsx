import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KnowledgeArticlePageContent } from "../../../features/knowledge-center/components/KnowledgeArticlePageContent";
import { fetchKnowledgeArticle } from "../../../features/knowledge-center/api";
import { applyPageSeoOverrideToMetadataInput } from "../../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import { buildUnavailablePublicMetadata } from "../../../lib/seo/public-surface-copy";
import { JsonLdScript, buildWebPageJsonLd } from "../../../lib/seo/structured-data";

interface KnowledgeArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: KnowledgeArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonicalPath = `/knowledge/${encodeURIComponent(slug)}`;

  try {
    const article = await fetchKnowledgeArticle(slug);
    const description =
      article.purpose?.trim() || `${article.title} — Knowledge on Humanity Union`;
    const override = await fetchPublicSeoPageOverride({
      family: "knowledge",
      entityKey: slug,
    });

    return buildPublicPageMetadata(
      applyPageSeoOverrideToMetadataInput(
        {
          title: article.title,
          description,
          canonicalPath,
          socialTitle: article.title,
          socialDescription: description,
          openGraphType: "website",
        },
        override?.fields,
      ),
    );
  } catch {
    return buildUnavailablePublicMetadata("Knowledge article not found | Humanity Union");
  }
}

export default async function KnowledgeArticlePage({ params }: KnowledgeArticlePageProps) {
  const { slug } = await params;

  let structuredData = null;
  try {
    const article = await fetchKnowledgeArticle(slug);
    const description =
      article.purpose?.trim() || `${article.title} — Knowledge on Humanity Union`;
    const canonicalPath = `/knowledge/${encodeURIComponent(slug)}`;
    const override = await fetchPublicSeoPageOverride({
      family: "knowledge",
      entityKey: slug,
    });
    const effectiveTitle = override?.fields.seoTitle?.trim() || article.title;
    const effectiveDescription = override?.fields.seoDescription?.trim() || description;
    const effectiveImage = override?.fields.socialImageUrl?.trim() || undefined;

    structuredData = buildWebPageJsonLd({
      name: effectiveTitle,
      description: effectiveDescription,
      canonicalPath,
      imageUrl: effectiveImage,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Knowledge", path: "/knowledge" },
        { name: effectiveTitle, path: canonicalPath },
      ],
    });
  } catch {
    notFound();
  }

  return (
    <>
      <JsonLdScript data={structuredData} />
      <KnowledgeArticlePageContent slug={slug} />
    </>
  );
}
