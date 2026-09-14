"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import {
  getDeferredInstallPrompt,
  resolvePwaInstallUxState,
  subscribeInstallPrompt,
  type PwaInstallUxState,
} from "../install-state";
import { subscribePresentationMode } from "../presentation-mode";
import { PwaInstallGuidance, type PwaInstallGuidanceKind } from "./PwaInstallGuidance";

/**
 * Home App column install UX — persistently discoverable.
 * When not installed: primary Install CTA + secondary Installation guide
 * (except iOS, which keeps Add to Home Screen as the primary action).
 * Native `beforeinstallprompt` is used when available; otherwise Install
 * opens the existing installation guidance. No temporary dismiss / Later.
 */
export function PwaInstallPromotion() {
  const t = useTranslations("pwa");
  const [uxState, setUxState] = useState<PwaInstallUxState>("browser_mode");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceKind, setGuidanceKind] = useState<PwaInstallGuidanceKind>("browser");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUxState(
        resolvePwaInstallUxState({
          deferredPrompt: getDeferredInstallPrompt(),
        }),
      );
    };

    sync();
    const unsubPrompt = subscribeInstallPrompt(sync);
    const unsubMode = subscribePresentationMode(() => sync());
    return () => {
      unsubPrompt();
      unsubMode();
    };
  }, []);

  function openGuidance(kind: PwaInstallGuidanceKind) {
    setGuidanceKind(kind);
    setGuidanceOpen(true);
  }

  function openDefaultGuide() {
    if (uxState === "ios_add_to_home") {
      openGuidance("ios");
      return;
    }
    if (uxState === "install_available") {
      openGuidance("android");
      return;
    }
    openGuidance("browser");
  }

  async function handlePrimaryInstallCta() {
    const prompt = getDeferredInstallPrompt();
    if (prompt) {
      setBusy(true);
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        setBusy(false);
        setUxState(resolvePwaInstallUxState({ deferredPrompt: getDeferredInstallPrompt() }));
      }
      return;
    }

    openDefaultGuide();
  }

  const runningStandalone = uxState === "already_installed";
  const isIos = uxState === "ios_add_to_home";
  /** Primary Install CTA when not installed and not on the iOS A2HS path. */
  const showInstallAction = !runningStandalone && !isIos;
  /** iOS keeps Add to Home Screen as the primary install action. */
  const showIosAction = isIos;
  /** Installation guide always available when not installed (independent of BIP). */
  const showInstallationGuide = !runningStandalone;
  const automaticInstallAvailable = uxState === "install_available";

  return (
    <div className="hu-pwa-install-column">
      <h3>{t("install.appTitle")}</h3>
      <p>{t("install.lead")}</p>

      {runningStandalone ? (
        <div className="hu-pwa-install-actions">
          <p className="hu-pwa-install-status" role="status">
            {t("install.alreadyInstalled")}
          </p>
          <Button type="button" variant="primary" href="/workspace">
            {t("install.openWorkspace")}
          </Button>
        </div>
      ) : (
        <div className="hu-pwa-install-actions">
          {showInstallAction ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => void handlePrimaryInstallCta()}
              disabled={busy}
            >
              {busy ? t("install.installing") : t("install.installCta")}
            </Button>
          ) : null}

          {showIosAction ? (
            <Button type="button" variant="primary" onClick={() => openGuidance("ios")}>
              {t("install.addToHomeScreen")}
            </Button>
          ) : null}

          {showInstallationGuide ? (
            <Button type="button" variant="secondary" onClick={openDefaultGuide}>
              {t("install.installationGuide")}
            </Button>
          ) : null}
        </div>
      )}

      <PwaInstallGuidance
        open={guidanceOpen}
        kind={guidanceKind}
        alreadyInstalled={runningStandalone}
        automaticInstallAvailable={automaticInstallAvailable}
        onClose={() => setGuidanceOpen(false)}
      />
    </div>
  );
}
