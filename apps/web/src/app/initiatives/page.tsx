import { ApiUnavailableState } from "../../design-system";
import { WorldInitiativesPageContent } from "../../features/initiatives/components/WorldInitiativesPageContent";
import { fetchWorldInitiativesProjection } from "../../features/initiatives/world-initiatives-api";

import "./initiatives-page.css";

export default async function InitiativesPage() {
  let projection = null;
  let unavailable = false;

  try {
    projection = await fetchWorldInitiativesProjection();
  } catch {
    unavailable = true;
  }

  if (unavailable || !projection) {
    return (
      <main className="initiatives-page humanity-workspace-page">
        <ApiUnavailableState
          title="World initiatives temporarily unavailable"
          explanation="We couldn't load published world initiatives. Please try again shortly."
          retryHref="/initiatives"
          retryLabel="Retry"
          homeLabel="Return Home"
        />
      </main>
    );
  }

  return (
    <main className="initiatives-page humanity-workspace-page">
      <WorldInitiativesPageContent projection={projection.initiatives} />
    </main>
  );
}
