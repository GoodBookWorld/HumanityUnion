"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminLegalLocalizationSection } from "../../../features/administration/components/AdminLegalLocalizationSection";

export default function AdminLegalLocalizationPage() {
  return (
    <AdminAccessGate>
      {(user) => <AdminLegalLocalizationSection user={user} />}
    </AdminAccessGate>
  );
}
