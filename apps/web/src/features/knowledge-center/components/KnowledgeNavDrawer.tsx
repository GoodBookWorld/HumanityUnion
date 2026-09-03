"use client";

import Image from "next/image";
import { useEffect, useId, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";

import type { KnowledgeCenterListing } from "@hu/types";

import { trapTabKey } from "../../../design-system/focus-trap";
import { KnowledgeSidebar } from "./KnowledgeSidebar";

const CLOSE_ICON = "/icons/workspace/cross.svg";

interface KnowledgeNavDrawerProps {
  open: boolean;
  listing: KnowledgeCenterListing;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * PWA UX Correction Pack 03 — mobile Knowledge menu.
 * Reuses the Workspace Drawer interaction model (~80% width, backdrop, Escape, focus restore).
 */
export function KnowledgeNavDrawer({
  open,
  listing,
  onClose,
  returnFocusRef,
}: KnowledgeNavDrawerProps) {
  const tMenu = useTranslations("knowledgePublic.menu");
  const tNav = useTranslations("knowledgePublic.nav");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = returnFocusRef?.current ?? previouslyFocused.current;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (panelRef.current) {
        trapTabKey(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      focusTarget?.focus?.();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div className="knowledge-center__drawer" role="presentation">
      <button
        type="button"
        className="knowledge-center__drawer-backdrop"
        aria-label={tMenu("closeAria")}
        onClick={onClose}
      />
      <div
        id="knowledge-center-drawer-panel"
        ref={panelRef}
        className="knowledge-center__drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="knowledge-center__drawer-header">
          <h2 id={titleId} className="knowledge-center__drawer-title">
            {tNav("title")}
          </h2>
          <button
            type="button"
            className="knowledge-center__drawer-close"
            aria-label={tMenu("closeAria")}
            onClick={onClose}
          >
            <Image
              src={CLOSE_ICON}
              alt=""
              width={20}
              height={20}
              className="knowledge-center__drawer-close-icon"
              aria-hidden="true"
              unoptimized
            />
          </button>
        </div>
        <KnowledgeSidebar listing={listing} onNavigate={onClose} variant="drawer" />
      </div>
    </div>
  );
}
