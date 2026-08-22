"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminMediaResourcesSection } from "../../../features/administration/components/AdminMediaResourcesSection";

export default function AdminMediaResourcesPage() {
  return (
    <AdminAccessGate>{(user) => <AdminMediaResourcesSection user={user} />}</AdminAccessGate>
  );
}
