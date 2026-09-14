"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type RefObject } from "react";

import { trapTabKey } from "../../../design-system/focus-trap";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";

const CLOSE_ICON = "/icons/workspace/cross.svg";

interface PwaWorkspaceDrawerProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function PwaWorkspaceDrawer({ open, onClose, returnFocusRef }: PwaWorkspaceDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  /** Set when closing via nav selection — skip restoring focus to the Avatar launcher. */
  const skipFocusRestoreRef = useRef(false);
  const tWorkspace = useTranslations("workspace");
  const tNav = useTranslations("navigation");

  useEffect(() => {
    if (!open) {
      return;
    }

    skipFocusRestoreRef.current = false;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = returnFocusRef?.current ?? previouslyFocused.current;
    panelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (!skipFocusRestoreRef.current) {
        focusTarget?.focus?.();
      }
    };
  }, [open, onClose, returnFocusRef]);

  function handleNavigate() {
    // Close immediately on selection (incl. already-active route). Link still navigates.
    skipFocusRestoreRef.current = true;
    onClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="hu-pwa-drawer" role="presentation">
      <button
        type="button"
        className="hu-pwa-drawer__backdrop"
        aria-label={tWorkspace("closeMenu")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="hu-pwa-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="hu-pwa-drawer__header">
          <h2 id={titleId} className="hu-pwa-drawer__title">
            {tNav("workspace")}
          </h2>
          <button
            type="button"
            className="hu-pwa-drawer__close"
            aria-label={tWorkspace("closeMenu")}
            onClick={onClose}
          >
            <Image
              src={CLOSE_ICON}
              alt=""
              width={20}
              height={20}
              className="hu-pwa-drawer__close-icon"
              aria-hidden="true"
              unoptimized
            />
          </button>
        </div>
        <WorkspaceNavigation onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
