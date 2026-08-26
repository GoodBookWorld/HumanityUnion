import type { Metadata } from "next";
import { Suspense } from "react";

import { BlogSubscriptionUnsubscribePageContent } from "../../../../features/blog/components/BlogSubscriptionUnsubscribePageContent";

export const metadata: Metadata = {
  title: "Unsubscribe | Humanity Union Blog",
  robots: { index: false, follow: false },
};

export default function BlogSubscribeUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="blog-page hu-page-container">
          <p className="blog-page__status">Updating your subscription…</p>
        </main>
      }
    >
      <BlogSubscriptionUnsubscribePageContent />
    </Suspense>
  );
}
