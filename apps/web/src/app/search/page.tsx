import { Suspense } from "react";

import { GlobalSearchPageContent } from "../../features/global-search/components/GlobalSearchPageContent";

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="global-search-page">Loading search...</main>}>
      <GlobalSearchPageContent />
    </Suspense>
  );
}
