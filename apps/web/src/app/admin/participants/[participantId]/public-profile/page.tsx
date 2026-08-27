"use client";

import { use } from "react";

import { AdminAccessGate } from "../../../../../features/administration/components/AdminAccessGate";
import { AdminParticipantPublicProfileRedirect } from "../../../../../features/administration/components/AdminParticipantPublicProfileRedirect";

interface AdminParticipantPublicProfilePageProps {
  params: Promise<{ participantId: string }>;
}

/**
 * Pack 24A — Admin-only public-profile bridge.
 * Resolves CURRENT publicName from stable participantId, then redirects to
 * canonical `/member/{publicName}` (never Member.uniqueName).
 */
export default function AdminParticipantPublicProfilePage({
  params,
}: AdminParticipantPublicProfilePageProps) {
  const { participantId } = use(params);

  return (
    <AdminAccessGate>
      {(user) => (
        <AdminParticipantPublicProfileRedirect user={user} participantId={participantId} />
      )}
    </AdminAccessGate>
  );
}
