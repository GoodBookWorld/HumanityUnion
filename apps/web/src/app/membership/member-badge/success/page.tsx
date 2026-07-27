import { Suspense } from "react";

import { LoadingState } from "../../../../design-system";
import { MemberBadgeSuccessPageContent } from "../../../../features/membership/components/MemberBadgeSuccessPageContent";

export default function MemberBadgeSuccessPage() {
  return (
    <main className="humanity-workspace-page membership-member-badge-success-route">
      <Suspense fallback={<LoadingState message="Loading Badge request status..." />}>
        <MemberBadgeSuccessPageContent />
      </Suspense>
    </main>
  );
}
