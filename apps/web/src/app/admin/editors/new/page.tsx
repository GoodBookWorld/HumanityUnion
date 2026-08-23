"use client";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminEditorFormSection } from "../../../../features/administration/components/AdminEditorFormSection";

export default function AdminEditorsNewPage() {
  return (
    <AdminAccessGate>{() => <AdminEditorFormSection mode="create" />}</AdminAccessGate>
  );
}
