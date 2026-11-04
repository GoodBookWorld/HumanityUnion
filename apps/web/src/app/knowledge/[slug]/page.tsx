import type { KnowledgeArticlePublic } from "@hu/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KnowledgeArticlePageContent } from "../../../features/knowledge-center/components/KnowledgeArticlePageContent";
import { fetchKnowledgeArticle, fetchKnowledgeListing } from "../../../features/knowledge-center/api";
import { buildKnowledgeArticleMetaDescription } from "../../../features/knowledge-center/knowledge-article-meta-description";
import { applyPageSeoOverrideToMetadataInput } from "../../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadataForRequest } from "../../../lib/seo/build-public-page-metadata-for-request";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import { buildUnavailablePublicMetadata } from "../../../lib/seo/public-surface-copy";
import { JsonLdScript, buildWebPageJsonLd } from "../../../lib/seo/structured-data";

interface KnowledgeArticlePageProps {
  params: Promise<{ slug: string }>;
}

/** Step 07C.3 — request-aware canonical/hreflang; title/desc remain article fields. */
export async function generateMetadata({ params }: KnowledgeArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const localeFreeCanonicalPath = `/knowledge/${encodeURIComponent(slug)}`;

  try {
    const article = await fetchKnowledgeArticle(slug);
    const description = buildKnowledgeArticleMetaDescription(article);
    const override = await fetchPublicSeoPageOverride({
      family: "knowledge",
      entityKey: slug,
    });

    return buildPublicPageMetadataForRequest({
      ...applyPageSeoOverrideToMetadataInput(
        {
          title: article.title,
          description,
          canonicalPath: localeFreeCanonicalPath,
          socialTitle: article.title,
          socialDescription: description,
          openGraphType: "website",
        },
        override?.fields,
      ),
      localeFreeCanonicalPath,
    });
  } catch {
    return buildUnavailablePublicMetadata("Knowledge article not found | Humanity Union");
  }
}

export default async function KnowledgeArticlePage({ params }: KnowledgeArticlePageProps) {
  const { slug } = await params;

  let structuredData = null;
  let article: KnowledgeArticlePublic;
  try {
    article = await fetchKnowledgeArticle(slug);
    const description = buildKnowledgeArticleMetaDescription(article);
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

  // The menu listing is optional for the first render; the client fetches it if missing.
  const listing = await fetchKnowledgeListing().catch(() => null);

  return (
    <>
      <JsonLdScript data={structuredData} />
      <KnowledgeArticlePageContent
        key={slug}
        slug={slug}
        initialArticle={article}
        initialListing={listing}
      />
    </>
  );
}
