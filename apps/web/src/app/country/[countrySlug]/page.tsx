import { notFound, redirect } from "next/navigation";

import { normalizeCountryInput } from "../../../data/geography";

interface LegacyCountryPageProps {
  params: Promise<{ countrySlug: string }>;
}

export default async function LegacyCountryPage({ params }: LegacyCountryPageProps) {
  const { countrySlug } = await params;
  const countryCode = normalizeCountryInput(countrySlug);

  if (!countryCode) {
    notFound();
  }

  redirect(`/countries/${countryCode}`);
}
