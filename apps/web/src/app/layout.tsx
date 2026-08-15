import type { Metadata, Viewport } from "next";

import { HumanityLayout } from "../design-system/components/HumanityLayout";
import { shouldDisallowSearchIndexing } from "../lib/platform-indexing";

import "./globals.css";

const disallowIndexing = shouldDisallowSearchIndexing();

export const metadata: Metadata = {
  title: "Humanity Union",
  description: "World Solidarity civic technology platform",
  applicationName: "Humanity Union",
  robots: disallowIndexing
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: "Humanity Union",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="humanity-app">
        <HumanityLayout>{children}</HumanityLayout>
      </body>
    </html>
  );
}
