"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminViewsTrafficSection } from "../../../features/administration/components/AdminViewsTrafficSection";

export default function AdminViewsTrafficPage() {
  return (
    <AdminAccessGate>{(user) => <AdminViewsTrafficSection user={user} />}</AdminAccessGate>
  );
}
