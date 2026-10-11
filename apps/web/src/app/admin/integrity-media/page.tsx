"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminIntegrityAuthorsSection } from "../../../features/administration/components/AdminIntegrityAuthorsSection";

export default function AdminIntegrityMediaPage() {
  return (
    <AdminAccessGate>{(user) => <AdminIntegrityAuthorsSection user={user} />}</AdminAccessGate>
  );
}
