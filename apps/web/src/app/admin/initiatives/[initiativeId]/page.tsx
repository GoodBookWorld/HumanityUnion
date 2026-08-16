"use client";

import { use } from "react";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminInitiativeDetailSection } from "../../../../features/administration/components/AdminInitiativeDetailSection";

interface AdminInitiativeDetailPageProps {
  params: Promise<{ initiativeId: string }>;
}

export default function AdminInitiativeDetailPage({ params }: AdminInitiativeDetailPageProps) {
  const { initiativeId } = use(params);

  return (
    <AdminAccessGate>
      {(user) => (
        <AdminInitiativeDetailSection user={user} initiativeId={initiativeId} />
      )}
    </AdminAccessGate>
  );
}
