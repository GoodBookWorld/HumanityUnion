import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { CANONICAL_ENGLISH_BRAND_FALLBACK } from "@hu/types";

import { HumanityLayout } from "../design-system/components/HumanityLayout";
import { resolveBrandForMetadata } from "../features/brand-localization/resolve-brand-for-metadata";
import { loadUiMessagesForLocale } from "../features/i18n/load-ui-messages";
import { resolveDocumentHtmlLocale } from "../features/language/resolve-document-locale";
import { PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP } from "../features/pwa/pwa-launch-first-paint-bootstrap";
import { JsonLdScript, buildRootStructuredData } from "../lib/seo/structured-data";

import "./globals.css";

/**
 * Pack 08I.2 — applicationName / appleWebApp.title stay static PWA_BRAND
 * (canonical English fallback). Runtime-localized brand is for HTML chrome / SEO only.
 */
const PWA_BRAND = CANONICAL_ENGLISH_BRAND_FALLBACK;

export const metadata: Metadata = {
  applicationName: PWA_BRAND.siteName,
  appleWebApp: {
    capable: true,
    title: PWA_BRAND.siteName,
    // default keeps status-bar text readable against light app chrome
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "32x32" },
      { url: "/brand/app-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/app-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0174b0",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pack 02C — single authoritative interface locale for html lang/dir + i18n.
  const documentLocale = await resolveDocumentHtmlLocale();
  // Pack 08I.2 — async brand resolve for Organization/WebSite JSON-LD name.
  const brand = await resolveBrandForMetadata(documentLocale.locale);
  const rootStructuredData = buildRootStructuredData(undefined, brand.openGraphBrandName);
  const uiMessages = await loadUiMessagesForLocale(documentLocale.locale);

  return (
    <html
      lang={documentLocale.locale}
      dir={documentLocale.textDirection}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="humanity-app">
        {/* Pack 22I.2 — runs before React hydration; cover only for installed PWA + unplayed session. */}
        <script
          dangerouslySetInnerHTML={{ __html: PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP }}
        />
        <JsonLdScript data={rootStructuredData} />
        <NextIntlClientProvider locale={documentLocale.locale} messages={uiMessages.messages}>
          <HumanityLayout>{children}</HumanityLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
