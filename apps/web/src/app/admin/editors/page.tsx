"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminEditorsSection } from "../../../features/administration/components/AdminEditorsSection";

export default function AdminEditorsPage() {
  return <AdminAccessGate>{(user) => <AdminEditorsSection user={user} />}</AdminAccessGate>;
}
