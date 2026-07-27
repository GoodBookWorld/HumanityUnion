import { Suspense } from "react";

import { LoadingState } from "../../../design-system";
import { MemberBadgePageContent } from "../../../features/membership/components/MemberBadgePageContent";

export default function MemberBadgePage() {
  return (
    <main className="humanity-workspace-page membership-member-badge-route">
      <Suspense fallback={<LoadingState message="Loading Member Badge information..." />}>
        <MemberBadgePageContent />
      </Suspense>
    </main>
  );
}
