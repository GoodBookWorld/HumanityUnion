"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminPlatformSection } from "../../../features/administration/components/AdminPlatformSection";

export default function AdminPlatformPage() {
  return <AdminAccessGate>{(user) => <AdminPlatformSection user={user} />}</AdminAccessGate>;
}
