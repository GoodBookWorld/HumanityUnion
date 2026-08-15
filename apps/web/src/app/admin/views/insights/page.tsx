"use client";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminViewsInsightsSection } from "../../../../features/administration/components/AdminViewsInsightsSection";

export default function AdminViewsInsightsPage() {
  return (
    <AdminAccessGate>{(user) => <AdminViewsInsightsSection user={user} />}</AdminAccessGate>
  );
}
