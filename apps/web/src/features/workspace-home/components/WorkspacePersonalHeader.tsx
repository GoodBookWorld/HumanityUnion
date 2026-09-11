"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import "./workspace-personal-header.css";

export function WorkspacePersonalHeader() {
  const router = useRouter();
  const t = useTranslations("workspace");

  async function handleLogout() {
    const { logout } = await import("../../auth/auth-api");
    await logout();
    router.push("/login");
  }

  return (
    <div className="workspace-personal-header">
      <div className="workspace-personal-header__actions">
        <p className="workspace-personal-header__workspace-label">{t("home.currentWorkspace")}</p>
        <Link className="workspace-personal-header__link" href="/workspace">
          {t("workspaceHome")}
        </Link>
        <button
          type="button"
          className="workspace-personal-header__logout"
          onClick={() => void handleLogout()}
        >
          {t("home.logout")}
        </button>
      </div>
    </div>
  );
}
