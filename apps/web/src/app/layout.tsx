import type { Metadata } from "next";

import { HumanityLayout } from "../design-system/components/HumanityLayout";

import "./globals.css";

export const metadata: Metadata = {
  title: "Humanity Union",
  description: "World Solidarity civic technology platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="humanity-app">
        <HumanityLayout>{children}</HumanityLayout>
      </body>
    </html>
  );
}
