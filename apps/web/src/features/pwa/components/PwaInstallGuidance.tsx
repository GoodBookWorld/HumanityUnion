"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { trapTabKey } from "../../../design-system/focus-trap";
import { Button } from "../../../design-system";

/**
 * Which platform section to visually emphasize.
 * Both Android and iOS instructions always remain visible.
 */
export type PwaInstallGuidanceKind = "ios" | "browser" | "android";

interface PwaInstallGuidanceProps {
  open: boolean;
  kind: PwaInstallGuidanceKind;
  /** When true, show already-installed status instead of install steps. */
  alreadyInstalled?: boolean;
  /**
   * Pack 23D.1 — when false (no beforeinstallprompt), surface a truthful note that
   * automatic install may require a normal browser session.
   */
  automaticInstallAvailable?: boolean;
  onClose: () => void;
}

/**
 * Pack 23D — Install help for Android + iPhone/iPad.
 * Pack 23D.1 — wider viewport-fit dialog; backdrop click closes; × close control.
 * Pack 23D.2 — portaled to `document.body` so Home install-column overflow/stacking
 * cannot clip or stretch the dialog (`hu-pwa-install-column > * { position: relative }`).
 */
export function PwaInstallGuidance({
  open,
  kind,
  alreadyInstalled = false,
  automaticInstallAvailable = false,
  onClose,
}: PwaInstallGuidanceProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    previouslyFocused.current =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    dialog?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, mounted, onClose]);

  if (!open || !mounted || typeof document === "undefined") {
    return null;
  }

  const emphasizeIos = kind === "ios";
  const emphasizeAndroid = kind === "android" || kind === "browser";

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function stopDialogClickPropagation(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return createPortal(
    <div className="hu-pwa-ios-help" role="presentation" onClick={handleOverlayClick}>
      <div className="hu-pwa-ios-help__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="hu-pwa-ios-help__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={stopDialogClickPropagation}
      >
        <div className="hu-pwa-ios-help__header">
          <h2 id={titleId}>Install Humanity Union App</h2>
          <button
            type="button"
            className="hu-pwa-ios-help__close"
            aria-label="Close installation guide"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="hu-pwa-ios-help__body">
          <p className="hu-pwa-ios-help__subtitle">
            Add Humanity Union to your Home Screen for faster access and an app-like experience.
          </p>

          {alreadyInstalled ? (
            <div className="hu-pwa-ios-help__installed" role="status">
              <p>Humanity Union is already installed on this device.</p>
              <Button type="button" variant="primary" href="/workspace">
                Open Workspace
              </Button>
            </div>
          ) : (
            <>
              {!automaticInstallAvailable ? (
                <p className="hu-pwa-ios-help__hint hu-pwa-ios-help__hint--banner" role="note">
                  Automatic install is not available in this browser session. Use the steps below, or
                  reopen Humanity Union in a normal (non-private) browser window if installation does
                  not appear.
                </p>
              ) : null}

              <div className="hu-pwa-ios-help__platforms">
                <section
                  className={
                    emphasizeAndroid
                      ? "hu-pwa-ios-help__card hu-pwa-ios-help__card--emphasized"
                      : "hu-pwa-ios-help__card"
                  }
                  aria-labelledby={`${titleId}-android`}
                >
                  <h3 id={`${titleId}-android`}>Android — Chrome</h3>
                  <p className="hu-pwa-ios-help__hint">
                    If an <strong>Install Humanity Union</strong> button is available on this page,
                    use it first.
                  </p>
                  <ol>
                    <li>Open Humanity Union in Chrome.</li>
                    <li>Tap the browser menu (⋮).</li>
                    <li>
                      Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </li>
                    <li>Confirm installation.</li>
                    <li>
                      The Humanity Union icon will appear on your Home Screen / app launcher.
                    </li>
                  </ol>
                  <p className="hu-pwa-ios-help__hint">
                    If Chrome does not show the install option: refresh the page, make sure the site
                    is opened in Chrome, and check that the app is not already installed.
                  </p>
                </section>

                <section
                  className={
                    emphasizeIos
                      ? "hu-pwa-ios-help__card hu-pwa-ios-help__card--emphasized"
                      : "hu-pwa-ios-help__card"
                  }
                  aria-labelledby={`${titleId}-ios`}
                >
                  <h3 id={`${titleId}-ios`}>iPhone / iPad — Safari</h3>
                  <ol>
                    <li>Open Humanity Union in Safari.</li>
                    <li>Tap the Share button.</li>
                    <li>
                      Scroll and choose <strong>Add to Home Screen</strong>.
                    </li>
                    <li>Review the app name.</li>
                    <li>
                      Tap <strong>Add</strong>.
                    </li>
                    <li>Launch Humanity Union from the new Home Screen icon.</li>
                  </ol>
                  <p className="hu-pwa-ios-help__hint">
                    <strong>Add to Home Screen</strong> must be done from Safari. If this page is open
                    inside another app&apos;s browser, open it in Safari first.
                  </p>
                  <p className="hu-pwa-ios-help__hint">
                    Allow notifications when prompted if you want supported badge and notification
                    features.
                  </p>
                </section>
              </div>

              <p className="hu-pwa-install-status hu-pwa-ios-help__note" role="note">
                Notification and app-icon badge behavior depends on your device, operating system,
                browser, and notification permissions.
              </p>
            </>
          )}
        </div>

        <div className="hu-pwa-ios-help__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
