import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { BlogIndexPageContent } from "../../features/blog/components/BlogIndexPageContent";

export const metadata: Metadata = {
  title: "Blog | Humanity Union",
  description:
    "Ideas, reflections and perspectives from Humanity Union authors across Conscious Existence, Human Security, and Our Life.",
  alternates: {
    canonical: "/blog",
  },
};

async function BlogIndexSuspenseFallback() {
  const t = await getTranslations("blogPublic");
  return (
    <main className="blog-page hu-page-container">
      <p className="blog-page__status">{t("loadingPublications")}</p>
    </main>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogIndexSuspenseFallback />}>
      <BlogIndexPageContent />
    </Suspense>
  );
}
