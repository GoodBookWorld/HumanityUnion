import { Suspense } from "react";

import { DirectMessagesWorkspace } from "../../../../features/direct-messaging/components/DirectMessagesWorkspace";

interface WorkspaceMessageConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function WorkspaceMessageConversationPage({
  params,
}: WorkspaceMessageConversationPageProps) {
  const { conversationId: rawConversationId } = await params;

  /**
   * Communication UX Pack 03.8 Part 5 (recovery) — Next.js does not decode
   * this dynamic route segment for us: `conversationId` arrives exactly as
   * it appears in the URL path (e.g. still containing `%3A` for the `:` in
   * `direct-conversation:<id>::<id>`). Every conversation ID this app ever
   * generates is plain ASCII with no literal `%`, so `decodeURIComponent`
   * here is both safe and idempotent. Skipping this turned every open into
   * a permanent "Conversation not found" (the ID got encoded a second time
   * by `encodeURIComponent` in the API client) — not a timing race at all.
   */
  const conversationId = decodeURIComponent(rawConversationId);

  return (
    <main className="workspace-messages-page humanity-workspace-page">
      <Suspense fallback={<p>Loading Messages…</p>}>
        <DirectMessagesWorkspace activeConversationId={conversationId} />
      </Suspense>
    </main>
  );
}
