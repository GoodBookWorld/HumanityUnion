"use client";

import { AdminAccessGate } from "../../../features/administration/components/AdminAccessGate";
import { AdminCountryPeopleSection } from "../../../features/administration/components/AdminCountryPeopleSection";

export default function AdminCountryPeoplePage() {
  return (
    <AdminAccessGate>{(user) => <AdminCountryPeopleSection user={user} />}</AdminAccessGate>
  );
}
