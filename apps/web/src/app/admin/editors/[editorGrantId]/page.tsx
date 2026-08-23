"use client";

import { use } from "react";

import { AdminAccessGate } from "../../../../features/administration/components/AdminAccessGate";
import { AdminEditorEditSection } from "../../../../features/administration/components/AdminEditorEditSection";

export default function AdminEditorDetailPage({
  params,
}: {
  params: Promise<{ editorGrantId: string }>;
}) {
  const { editorGrantId } = use(params);

  return (
    <AdminAccessGate>
      {(user) => <AdminEditorEditSection user={user} editorGrantId={editorGrantId} />}
    </AdminAccessGate>
  );
}
