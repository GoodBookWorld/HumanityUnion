"use client";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminViewsSubscribersSection } from "../../../../features/administration/components/AdminViewsSubscribersSection";

export default function AdminViewsSubscribersPage() {
  return (
    <AdminAccessGate>{(user) => <AdminViewsSubscribersSection user={user} />}</AdminAccessGate>
  );
}
