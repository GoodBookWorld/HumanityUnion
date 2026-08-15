"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminAuditSection } from "../../../features/administration/components/AdminAuditSection";

export default function AdminAuditPage() {
  return <AdminAccessGate>{(user) => <AdminAuditSection user={user} />}</AdminAccessGate>;
}
