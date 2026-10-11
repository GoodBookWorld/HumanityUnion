"use client";

import { use } from "react";

import { AdminAccessGate } from "../../../../../features/administration/components/AdminAccessGate";
import { AdminInitiativeExperienceSection } from "../../../../../features/administration/components/AdminInitiativeExperienceSection";

interface AdminInitiativeExperiencePageProps {
  params: Promise<{ initiativeId: string }>;
}

export default function AdminInitiativeExperiencePage({
  params,
}: AdminInitiativeExperiencePageProps) {
  const { initiativeId } = use(params);

  return (
    <AdminAccessGate>
      {() => <AdminInitiativeExperienceSection initiativeId={initiativeId} />}
    </AdminAccessGate>
  );
}
