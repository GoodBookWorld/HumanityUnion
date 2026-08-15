"use client";

import { AdminAccessGate } from "../../features/administration/components/AdminAccessGate";
import { AdminOverviewSection } from "../../features/administration/components/AdminOverviewSection";

/**
 * Admin Overview — rendered inside layout gates; local AdminAccessGate supplies
 * the authenticated admin identity to the overview section.
 */
export default function AdminOverviewPage() {
  return <AdminAccessGate>{(user) => <AdminOverviewSection user={user} />}</AdminAccessGate>;
}
