"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import "./workspace-personal-header.css";

export function WorkspacePersonalHeader() {
  const router = useRouter();

  async function handleLogout() {
    const { logout } = await import("../../auth/auth-api");
    await logout();
    router.push("/login");
  }

  return (
    <div className="workspace-personal-header">
      <div className="workspace-personal-header__actions">
        <p className="workspace-personal-header__workspace-label">Current Workspace</p>
        <Link className="workspace-personal-header__link" href="/workspace">
          Workspace Home
        </Link>
        <button
          type="button"
          className="workspace-personal-header__logout"
          onClick={() => void handleLogout()}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
