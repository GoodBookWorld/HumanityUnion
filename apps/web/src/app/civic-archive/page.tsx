import { Suspense } from "react";

import { CivicArchiveFiltersLoading } from "../../features/public-civic-archive/components/CivicArchiveFiltersLoading";
import { CivicArchivePageChrome } from "../../features/public-civic-archive/components/CivicArchivePageChrome";
import { CivicArchiveSearchExperience } from "../../features/public-civic-archive/components/CivicArchiveSearchExperience";

import "./civic-archive-page.css";

export default function CivicArchiveIndexPage() {
  return (
    <main className="civic-archive-page">
      <CivicArchivePageChrome />

      <Suspense fallback={<CivicArchiveFiltersLoading />}>
        <CivicArchiveSearchExperience />
      </Suspense>
    </main>
  );
}
