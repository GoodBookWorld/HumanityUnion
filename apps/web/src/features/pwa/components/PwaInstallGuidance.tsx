"use client";

import { useEffect, useId, useRef } from "react";

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
  onClose: () => void;
}

/**
 * Pack 23D — Install help for Android + iPhone/iPad.
 * Truthful guidance — never claims the Web app can force an OS icon.
 */
export function PwaInstallGuidance({
  open,
  kind,
  alreadyInstalled = false,
  onClose,
}: PwaInstallGuidanceProps) {
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

  const emphasizeIos = kind === "ios";
  const emphasizeAndroid = kind === "android" || kind === "browser";

  return (
    <div className="hu-pwa-ios-help" role="presentation">
      <button
        type="button"
        className="hu-pwa-ios-help__backdrop"
        aria-label="Close install help"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="hu-pwa-ios-help__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>Install Humanity Union App</h2>
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

        <div className="hu-pwa-ios-help__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
