"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminLanguagesSection } from "../../../features/administration/components/AdminLanguagesSection";

export default function AdminLanguagesPage() {
  return <AdminAccessGate>{(user) => <AdminLanguagesSection user={user} />}</AdminAccessGate>;
}
