"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminTerminologyGlossarySection } from "../../../features/administration/components/AdminTerminologyGlossarySection";

export default function AdminTerminologyGlossaryPage() {
  return (
    <AdminAccessGate>
      {(user) => <AdminTerminologyGlossarySection user={user} />}
    </AdminAccessGate>
  );
}
