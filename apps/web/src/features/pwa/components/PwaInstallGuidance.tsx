"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import { trapTabKey } from "../../../design-system/focus-trap";
import { Button } from "../../../design-system";

/**
 * `ios` — compact Safari Add-to-Home-Screen steps only.
 * `android` / `browser` — combined installation guide (Android + iOS wall).
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
   * Not shown on the compact iOS A2HS modal.
   */
  automaticInstallAvailable?: boolean;
  onClose: () => void;
}

/**
 * Pack 23D — Install help for Android + iPhone/iPad (combined guide).
 * Historical iOS A2HS — when `kind === "ios"`, compact Safari-only steps.
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
  const t = useTranslations("pwa");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const iosFocused = kind === "ios";

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

  const title = iosFocused ? t("install.iosA2hsTitle") : t("install.guideTitle");

  return createPortal(
    <div className="hu-pwa-ios-help" role="presentation" onClick={handleOverlayClick}>
      <div className="hu-pwa-ios-help__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className={
          iosFocused
            ? "hu-pwa-ios-help__dialog hu-pwa-ios-help__dialog--compact"
            : "hu-pwa-ios-help__dialog"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={stopDialogClickPropagation}
        data-guidance-kind={kind}
      >
        <div className="hu-pwa-ios-help__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="hu-pwa-ios-help__close"
            aria-label={t("install.closeGuideAria")}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="hu-pwa-ios-help__body">
          {alreadyInstalled ? (
            <div className="hu-pwa-ios-help__installed" role="status">
              <p>{t("install.alreadyInstalled")}</p>
              <Button type="button" variant="primary" href="/workspace">
                {t("install.openWorkspace")}
              </Button>
            </div>
          ) : iosFocused ? (
            <>
              <ol className="hu-pwa-ios-help__a2hs-steps">
                <li>{t("install.iosA2hsStep1")}</li>
                <li>{t("install.iosA2hsStep2")}</li>
                <li>{t("install.iosA2hsStep3")}</li>
              </ol>
              <p className="hu-pwa-install-status hu-pwa-ios-help__note" role="note">
                {t("install.iosA2hsStandaloneNote")}
              </p>
            </>
          ) : (
            <>
              <p className="hu-pwa-ios-help__subtitle">{t("install.guideSubtitle")}</p>

              {!automaticInstallAvailable ? (
                <p className="hu-pwa-ios-help__hint hu-pwa-ios-help__hint--banner" role="note">
                  {t("install.automaticUnavailable")}
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
                  <h3 id={`${titleId}-android`}>{t("install.androidTitle")}</h3>
                  <p className="hu-pwa-ios-help__hint">{t("install.androidHintPrimary")}</p>
                  <ol>
                    <li>{t("install.androidStep1")}</li>
                    <li>{t("install.androidStep2")}</li>
                    <li>{t("install.androidStep3")}</li>
                    <li>{t("install.androidStep4")}</li>
                    <li>{t("install.androidStep5")}</li>
                  </ol>
                  <p className="hu-pwa-ios-help__hint">{t("install.androidHintSecondary")}</p>
                </section>

                <section
                  className={
                    emphasizeIos
                      ? "hu-pwa-ios-help__card hu-pwa-ios-help__card--emphasized"
                      : "hu-pwa-ios-help__card"
                  }
                  aria-labelledby={`${titleId}-ios`}
                >
                  <h3 id={`${titleId}-ios`}>{t("install.iosTitle")}</h3>
                  <ol>
                    <li>{t("install.iosStep1")}</li>
                    <li>{t("install.iosStep2")}</li>
                    <li>{t("install.iosStep3")}</li>
                    <li>{t("install.iosStep4")}</li>
                    <li>{t("install.iosStep5")}</li>
                    <li>{t("install.iosStep6")}</li>
                  </ol>
                  <p className="hu-pwa-ios-help__hint">{t("install.iosHintSafari")}</p>
                  <p className="hu-pwa-ios-help__hint">{t("install.iosHintNotifications")}</p>
                </section>
              </div>

              <p className="hu-pwa-install-status hu-pwa-ios-help__note" role="note">
                {t("install.badgeNote")}
              </p>
            </>
          )}
        </div>

        <div className="hu-pwa-ios-help__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            {t("install.close")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
