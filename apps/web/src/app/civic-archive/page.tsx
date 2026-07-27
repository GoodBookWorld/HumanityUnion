import { Suspense } from "react";

import { CivicArchiveSearchExperience } from "../../features/public-civic-archive/components/CivicArchiveSearchExperience";

import "./civic-archive-page.css";

export default function CivicArchiveIndexPage() {
  return (
    <main className="civic-archive-page">
      <header className="civic-archive-page__header">
        <h1>Humanity Union Public Civic Archive</h1>
        <p className="civic-archive-page__intro">
          Permanent institutional memory of completed civic initiatives and their verified public
          outcomes. Each archive record documents one initiative lifecycle — not isolated stage
          records.
        </p>
      </header>

      <Suspense
        fallback={<p className="civic-archive-page__filters-loading">Loading archive filters…</p>}
      >
        <CivicArchiveSearchExperience />
      </Suspense>
    </main>
  );
}
