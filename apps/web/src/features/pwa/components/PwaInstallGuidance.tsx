"use client";

import { useEffect, useId, useRef } from "react";

import { trapTabKey } from "../../../design-system/focus-trap";
import { Button } from "../../../design-system";

export type PwaInstallGuidanceKind = "ios" | "browser";

interface PwaInstallGuidanceProps {
  open: boolean;
  kind: PwaInstallGuidanceKind;
  onClose: () => void;
}

/**
 * Truthful install guidance — never claims the Web app can force an OS icon.
 */
export function PwaInstallGuidance({ open, kind, onClose }: PwaInstallGuidanceProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    dialog?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (dialog) {
        trapTabKey(event, dialog);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const title = kind === "ios" ? "Add to Home Screen" : "How to install Humanity";

  return (
    <div className="hu-pwa-ios-help" role="presentation">
      <div
        ref={dialogRef}
        className="hu-pwa-ios-help__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {kind === "ios" ? (
          <ol>
            <li>Open the browser Share menu.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Confirm Humanity Union.</li>
          </ol>
        ) : (
          <ol>
            <li>Open your browser menu (⋮ or ⋯).</li>
            <li>Look for Install app, Install Humanity, or Add to Home Screen.</li>
            <li>Confirm to add Humanity to your device.</li>
          </ol>
        )}
        <p className="hu-pwa-install-status" role="note">
          Browser and OS control where the icon appears. This site cannot force an icon onto your
          Home Screen or desktop.
        </p>
        <Button type="button" variant="primary" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
