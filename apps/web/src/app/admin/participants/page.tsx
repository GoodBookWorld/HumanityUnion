"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminParticipantsSection } from "../../../features/administration/components/AdminParticipantsSection";

export default function AdminParticipantsPage() {
  return (
    <AdminAccessGate>{(user) => <AdminParticipantsSection user={user} />}</AdminAccessGate>
  );
}
