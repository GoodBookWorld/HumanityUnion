import type { Metadata } from "next";
import { Suspense } from "react";

import { BlogIndexPageContent } from "../../features/blog/components/BlogIndexPageContent";

export const metadata: Metadata = {
  title: "Blog | Humanity Union",
  description:
    "Ideas, reflections and perspectives from Humanity Union authors across Conscious Existence, Human Security, and Our Life.",
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogPage() {
  return (
    <Suspense
      fallback={
        <main className="blog-page hu-page-container">
          <p className="blog-page__status">Loading Blog…</p>
        </main>
      }
    >
      <BlogIndexPageContent />
    </Suspense>
  );
}
