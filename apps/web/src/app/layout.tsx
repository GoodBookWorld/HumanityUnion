import type { Metadata } from "next";

import { HumanityLayout } from "../design-system/components/HumanityLayout";

import "./globals.css";

export const metadata: Metadata = {
  title: "Humanity Union",
  description: "World Solidarity civic technology platform",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "32x32" },
      { url: "/brand/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="humanity-app">
        <HumanityLayout>{children}</HumanityLayout>
      </body>
    </html>
  );
}
