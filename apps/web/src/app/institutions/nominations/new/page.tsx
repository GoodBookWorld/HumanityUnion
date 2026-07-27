import { Suspense } from "react";

import { CivicNominationFormPageContent } from "../../../../features/civic-nomination/components/CivicNominationFormPageContent";

export default function NewCivicNominationPage() {
  return (
    <Suspense fallback={<main className="civic-nomination-form-page">Loading form…</main>}>
      <CivicNominationFormPageContent />
    </Suspense>
  );
}
