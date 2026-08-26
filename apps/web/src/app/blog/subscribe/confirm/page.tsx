import type { Metadata } from "next";
import { Suspense } from "react";

import { BlogSubscriptionConfirmPageContent } from "../../../../features/blog/components/BlogSubscriptionConfirmPageContent";

export const metadata: Metadata = {
  title: "Confirm Blog subscription | Humanity Union",
  robots: { index: false, follow: false },
};

export default function BlogSubscribeConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="blog-page hu-page-container">
          <p className="blog-page__status">Confirming your subscription…</p>
        </main>
      }
    >
      <BlogSubscriptionConfirmPageContent />
    </Suspense>
  );
}
