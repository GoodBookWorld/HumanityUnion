/**
 * Pack 2.1 — validate locale-prefixed SEO public documents.
 * Invalid / non-SEO / disabled prefixes fail with notFound() (no silent fake locale).
 */

import { notFound } from "next/navigation";

import { resolvePublicSeoLocaleDocumentForRequest } from "../../features/language/resolve-document-locale";

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PublicSeoLocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: urlLocaleSegment } = await params;
  const resolution = await resolvePublicSeoLocaleDocumentForRequest({
    urlLocaleSegment,
  });

  if (!resolution.isLocalePrefixedDocument) {
    notFound();
  }

  return children;
}
