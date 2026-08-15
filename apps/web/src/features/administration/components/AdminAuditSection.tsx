"use client";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminAuditSectionProps {
  user: AuthUserPublic;
}

export function AdminAuditSection({ user: _user }: AdminAuditSectionProps) {
  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Audit">
        <p className="hu-body">
          An immutable Administration audit service exists in
          `apps/api/src/modules/administration/` (`record`, list helpers, repositories), and
          JWT admins resolve `platform.audit.read`. There is no Web-consumable HTTP route to
          browse audit records yet.
        </p>
        <p className="hu-caption admin-panel__note">
          Follow-up backend surface: a narrow admin-authorized `GET` audit browser (for
          example `/api/v1/admin/audit`) gated by `platform.audit.read`, returning safe
          projections without secrets.
        </p>
      </ProfileSection>
    </div>
  );
}
