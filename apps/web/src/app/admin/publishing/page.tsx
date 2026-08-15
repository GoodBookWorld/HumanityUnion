"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminPublishingSection } from "../../../features/administration/components/AdminPublishingSection";

export default function AdminPublishingPage() {
  return (
    <AdminAccessGate>{(user) => <AdminPublishingSection user={user} />}</AdminAccessGate>
  );
}
