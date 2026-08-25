"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminDiagnosticsSection } from "../../../features/administration/components/AdminDiagnosticsSection";

export default function AdminDiagnosticsPage() {
  return (
    <AdminAccessGate>{(user) => <AdminDiagnosticsSection user={user} />}</AdminAccessGate>
  );
}
