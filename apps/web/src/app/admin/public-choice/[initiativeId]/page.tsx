"use client";

import { use } from "react";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminPublicChoiceDetailSection } from "../../../../features/administration/components/AdminPublicChoiceDetailSection";

interface AdminPublicChoiceDetailPageProps {
  params: Promise<{ initiativeId: string }>;
}

export default function AdminPublicChoiceDetailPage({
  params,
}: AdminPublicChoiceDetailPageProps) {
  const { initiativeId } = use(params);

  return (
    <AdminAccessGate>
      {(user) => (
        <AdminPublicChoiceDetailSection user={user} initiativeId={initiativeId} />
      )}
    </AdminAccessGate>
  );
}
