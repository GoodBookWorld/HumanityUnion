"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminInitiativesSection } from "../../../features/administration/components/AdminInitiativesSection";

export default function AdminInitiativesPage() {
  return (
    <AdminAccessGate>{(user) => <AdminInitiativesSection user={user} />}</AdminAccessGate>
  );
}
