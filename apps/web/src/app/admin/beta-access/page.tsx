"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminBetaAccessSection } from "../../../features/administration/components/AdminBetaAccessSection";

export default function AdminBetaAccessPage() {
  return (
    <AdminAccessGate>{(user) => <AdminBetaAccessSection user={user} />}</AdminAccessGate>
  );
}
