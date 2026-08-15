import { Suspense } from "react";

import { DirectMessagesWorkspace } from "../../../features/direct-messaging/components/DirectMessagesWorkspace";

/**
 * Communication UX Pack 03.3.1 Part 1 — `humanity-workspace-page` is the
 * exact same centering/max-width/padding container Workspace Home and
 * Workspace Initiatives use, so Messages no longer sits shifted to the
 * left of the rest of Workspace on wide viewports.
 *
 * Communication UX Pack 03.9 Part 2 — `DirectMessagesWorkspace` now reads
 * `useSearchParams()` for `?mode=`/`?initiativeId=`/`?section=`, which
 * Next.js requires to be wrapped in a Suspense boundary.
 */
export default function WorkspaceMessagesPage() {
  return (
    <main className="workspace-messages-page humanity-workspace-page">
      <Suspense fallback={<p>Loading Messages…</p>}>
        <DirectMessagesWorkspace />
      </Suspense>
    </main>
  );
}
