"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminBrandLocalizationSection } from "../../../features/administration/components/AdminBrandLocalizationSection";

export default function AdminBrandLocalizationPage() {
  return (
    <AdminAccessGate>
      {(user) => <AdminBrandLocalizationSection user={user} />}
    </AdminAccessGate>
  );
}
