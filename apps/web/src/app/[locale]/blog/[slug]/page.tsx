/**
 * Pack 2.1 — locale-prefixed blog article; rejects non-SEO blog children (e.g. subscribe).
 */
import { notFound } from "next/navigation";
import { PUBLIC_SEO_LOCALE_RESERVED_BLOG_SLUGS } from "@hu/types";

import CanonicalPage, {
  generateMetadata as canonicalGenerateMetadata,
} from "../../../blog/[slug]/page";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata(props: Props) {
  const { slug } = await props.params;
  if (PUBLIC_SEO_LOCALE_RESERVED_BLOG_SLUGS.has(slug)) {
    notFound();
  }
  return canonicalGenerateMetadata({
    params: Promise.resolve({ slug }),
  });
}

export default async function LocalePrefixedBlogArticlePage(props: Props) {
  const { slug } = await props.params;
  if (PUBLIC_SEO_LOCALE_RESERVED_BLOG_SLUGS.has(slug)) {
    notFound();
  }
  return <CanonicalPage params={Promise.resolve({ slug })} />;
}
