"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { KnowledgeCenterListing } from "@hu/types";

import { KnowledgeNavDrawer } from "./KnowledgeNavDrawer";
import { KnowledgeSidebar } from "./KnowledgeSidebar";

import "../knowledge-center.css";

interface KnowledgeShellProps {
  listing: KnowledgeCenterListing | null;
  children: ReactNode;
}

/**
 * Shared Knowledge layout — desktop sticky sidebar + mobile drawer.
 * Main content always occupies the content column so selection is never hidden
 * behind a stacked full-height nav (Pack 03 defect root cause).
 */
export function KnowledgeShell({ listing, children }: KnowledgeShellProps) {
  const t = useTranslations("knowledgePublic.menu");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  return (
    <main className="knowledge-center">
      <div className="knowledge-center__mobile-bar">
        <button
          ref={launcherRef}
          type="button"
          className="knowledge-center__menu-launcher"
          aria-label={t("openAria")}
          aria-expanded={drawerOpen}
          aria-controls="knowledge-center-drawer-panel"
          onClick={() => setDrawerOpen(true)}
          disabled={!listing}
        >
          {t("open")}
        </button>
      </div>

      {listing ? (
        <>
          <KnowledgeSidebar listing={listing} variant="desktop" />
          <KnowledgeNavDrawer
            open={drawerOpen}
            listing={listing}
            onClose={() => setDrawerOpen(false)}
            returnFocusRef={launcherRef}
          />
        </>
      ) : null}

      <div className="knowledge-center__main">{children}</div>
    </main>
  );
}
