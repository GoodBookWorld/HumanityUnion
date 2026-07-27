import { CivicArchiveResultsPanelSkeleton } from "../../features/public-civic-archive/components/CivicArchiveResultsPanel";

import "./civic-archive-page.css";

export default function CivicArchiveLoadingPage() {
  return (
    <main className="civic-archive-page">
      <header className="civic-archive-page__header">
        <h1>Humanity Union Public Civic Archive</h1>
        <p className="civic-archive-page__intro">Loading archived initiative lifecycle records…</p>
      </header>
      <CivicArchiveResultsPanelSkeleton />
    </main>
  );
}
