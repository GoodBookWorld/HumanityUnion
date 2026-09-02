import { CivicArchivePageChrome } from "../../features/public-civic-archive/components/CivicArchivePageChrome";
import { CivicArchiveResultsPanelSkeleton } from "../../features/public-civic-archive/components/CivicArchiveResultsPanel";

import "./civic-archive-page.css";

export default function CivicArchiveLoadingPage() {
  return (
    <main className="civic-archive-page">
      <CivicArchivePageChrome loading />
      <CivicArchiveResultsPanelSkeleton />
    </main>
  );
}
