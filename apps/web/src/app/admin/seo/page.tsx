"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminSeoSection } from "../../../features/administration/components/AdminSeoSection";

export default function AdminSeoPage() {
  return <AdminAccessGate>{(user) => <AdminSeoSection user={user} />}</AdminAccessGate>;
}
