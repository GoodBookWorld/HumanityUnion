import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { normalizeCountryInput } from "@hu/geography";

import { buildUnavailablePublicMetadata } from "../../../lib/seo/public-surface-copy";

interface LegacyCountryPageProps {
  params: Promise<{ countrySlug: string }>;
}

/** Legacy slug route redirects — never a canonical SEO surface. */
export async function generateMetadata(): Promise<Metadata> {
  return buildUnavailablePublicMetadata("Country | Humanity Union");
}

export default async function LegacyCountryPage({ params }: LegacyCountryPageProps) {
  const { countrySlug } = await params;
  const countryCode = normalizeCountryInput(countrySlug);

  if (!countryCode) {
    notFound();
  }

  redirect(`/countries/${countryCode}`);
}
