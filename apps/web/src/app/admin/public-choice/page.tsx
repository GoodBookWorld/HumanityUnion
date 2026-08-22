"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminPublicChoiceSection } from "../../../features/administration/components/AdminPublicChoiceSection";

export default function AdminPublicChoicePage() {
  return (
    <AdminAccessGate>{(user) => <AdminPublicChoiceSection user={user} />}</AdminAccessGate>
  );
}
