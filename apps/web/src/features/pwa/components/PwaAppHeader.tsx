"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  getWorkspaceMemberIdentity,
  type WorkspaceMemberIdentity,
} from "../../member-profile/member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";
import { PwaGlobalMenu } from "./PwaGlobalMenu";
import { PwaWorkspaceDrawer } from "./PwaWorkspaceDrawer";

const BACK_ICON = "/icons/workspace/arrow.png";

function canGoBackMeaningfully(pathname: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Avoid a misleading Back that exits the installed app / site.
  if (window.history.length <= 1) {
    return false;
  }

  // Workspace home is the app landing surface — Back would often leave the app.
  if (pathname === "/workspace") {
    return false;
  }

  return true;
}

export function PwaAppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useClientAuthStatus();
  const tWorkspace = useTranslations("workspace");
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const [identity, setIdentity] = useState<WorkspaceMemberIdentity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    setShowBack(canGoBackMeaningfully(pathname));
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setIdentity(null);
      return;
    }

    let cancelled = false;

    async function loadIdentity() {
      try {
        const loaded = await getWorkspaceMemberIdentity();
        if (!cancelled) {
          setIdentity(loaded);
        }
      } catch {
        if (!cancelled) {
          setIdentity(null);
        }
      }
    }

    void loadIdentity();

    function handleProfileUpdated() {
      void loadIdentity();
    }

    window.addEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(MEMBER_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [authStatus]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  function handleBack() {
    if (canGoBackMeaningfully(pathname)) {
      router.back();
      return;
    }

    router.push("/workspace");
  }

  return (
    <>
      <header className="hu-pwa-app-header">
        <button
          ref={avatarButtonRef}
          type="button"
          className="hu-pwa-app-header__avatar"
          aria-label={drawerOpen ? tWorkspace("closeMenu") : tWorkspace("openMenu")}
          aria-expanded={drawerOpen}
          onClick={() => {
            setMenuOpen(false);
            setDrawerOpen((open) => !open);
          }}
        >
          <HumanityAvatar avatarUrl={identity?.avatarUrl} size={36} alt="" />
        </button>

        <form className="hu-pwa-app-header__search" role="search" onSubmit={handleSearch}>
          <label className="hu-visually-hidden" htmlFor="hu-pwa-app-search">
            Search Humanity Union
          </label>
          <input
            id="hu-pwa-app-search"
            className="hu-pwa-app-header__search-input"
            type="search"
            name="q"
            placeholder="Search Humanity Union"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </form>

        <div className="hu-pwa-app-header__tools">
          {showBack ? (
            <button
              type="button"
              className="hu-pwa-app-header__back"
              aria-label="Go back"
              onClick={handleBack}
            >
              <Image
                src={BACK_ICON}
                alt=""
                width={22}
                height={22}
                className="hu-pwa-app-header__back-icon"
                aria-hidden="true"
              />
            </button>
          ) : null}

          <button
            type="button"
            className="hu-pwa-app-header__menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => {
              setDrawerOpen(false);
              setMenuOpen((open) => !open);
            }}
          >
            <span className="hu-pwa-app-header__menu-glyph" aria-hidden="true">
              ☰
            </span>
          </button>
        </div>
      </header>

      <PwaWorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnFocusRef={avatarButtonRef}
      />
      <PwaGlobalMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
