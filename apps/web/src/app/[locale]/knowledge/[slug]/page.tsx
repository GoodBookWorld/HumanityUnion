/**
 * Pack 2.1 — locale-prefixed knowledge article; rejects non-SEO knowledge children (e.g. media).
 */
import { notFound } from "next/navigation";
import { PUBLIC_SEO_LOCALE_RESERVED_KNOWLEDGE_SLUGS } from "@hu/types";

import CanonicalPage, {
  generateMetadata as canonicalGenerateMetadata,
} from "../../../knowledge/[slug]/page";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  if (PUBLIC_SEO_LOCALE_RESERVED_KNOWLEDGE_SLUGS.has(slug)) {
    notFound();
  }
  return canonicalGenerateMetadata({
    params: Promise.resolve({ slug }),
  });
}

export default async function LocalePrefixedKnowledgeArticlePage(props: Props) {
  const { slug } = await props.params;
  if (PUBLIC_SEO_LOCALE_RESERVED_KNOWLEDGE_SLUGS.has(slug)) {
    notFound();
  }
  return <CanonicalPage params={Promise.resolve({ slug })} />;
}
