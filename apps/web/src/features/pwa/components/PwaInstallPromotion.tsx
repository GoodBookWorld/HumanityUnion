"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../design-system";
import {
  clearObsoleteInstallPreferenceKeys,
  dismissInstallPromotion,
  wasInstallPromotionDismissedRecently,
} from "../install-preference";
import {
  getDeferredInstallPrompt,
  resolvePwaInstallUxState,
  subscribeInstallPrompt,
  type PwaInstallUxState,
} from "../install-state";
import { subscribePresentationMode } from "../presentation-mode";
import { PwaInstallGuidance, type PwaInstallGuidanceKind } from "./PwaInstallGuidance";

/**
 * Home App column install UX — promotion block stays discoverable.
 * Dismissal temporarily hides CTAs; it is not proof the OS still has the app.
 * Standalone (running as installed app) shows a compact Installed status only.
 *
 * Ordinary browser mode must never become an actionless dead end: always offer
 * Install / Add to Home Screen / How to install, plus Later, or Show install options.
 */
export function PwaInstallPromotion() {
  const [uxState, setUxState] = useState<PwaInstallUxState>("browser_mode");
  const [dismissed, setDismissed] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceKind, setGuidanceKind] = useState<PwaInstallGuidanceKind>("browser");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clearObsoleteInstallPreferenceKeys();
    setDismissed(wasInstallPromotionDismissedRecently());

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

  async function handleInstall() {
    const prompt = getDeferredInstallPrompt();
    if (!prompt) {
      return;
    }

    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setBusy(false);
      setUxState(resolvePwaInstallUxState({ deferredPrompt: getDeferredInstallPrompt() }));
    }
  }

  function handleDismiss() {
    dismissInstallPromotion();
    setDismissed(true);
  }

  function handleShowAgain() {
    setDismissed(false);
  }

  function openGuidance(kind: PwaInstallGuidanceKind) {
    setGuidanceKind(kind);
    setGuidanceOpen(true);
  }

  const runningStandalone = uxState === "already_installed";
  const showInstallAction = uxState === "install_available" && !dismissed;
  const showIosAction = uxState === "ios_add_to_home" && !dismissed;
  const showHowToInstall =
    !dismissed && (uxState === "unsupported" || uxState === "browser_mode");

  return (
    <div className="hu-pwa-install-column">
      <h3>Humanity Union App</h3>
      <p>
        Take Humanity with you. Install the app for direct access to your Workspace, Initiatives,
        Notifications and Humanity Union Assistant.
      </p>

      {runningStandalone ? (
        <div className="hu-pwa-install-actions">
          <p className="hu-pwa-install-status" role="status">
            Humanity Union is already installed on this device.
          </p>
          <Button type="button" variant="primary" href="/workspace">
            Open Workspace
          </Button>
        </div>
      ) : null}

      {!runningStandalone && dismissed ? (
        <div className="hu-pwa-install-actions">
          <p className="hu-pwa-install-status" role="status">
            Install guidance is hidden for this session.
          </p>
          <Button type="button" variant="secondary" onClick={handleShowAgain}>
            Show install options
          </Button>
        </div>
      ) : null}

      {!runningStandalone && !dismissed ? (
        <div className="hu-pwa-install-actions">
          {showInstallAction ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleInstall()}
              disabled={busy}
            >
              {busy ? "Installing…" : "Install Humanity Union"}
            </Button>
          ) : null}

          {showInstallAction ? (
            <Button type="button" variant="secondary" onClick={() => openGuidance("android")}>
              Installation guide
            </Button>
          ) : null}

          {showIosAction ? (
            <Button type="button" variant="primary" onClick={() => openGuidance("ios")}>
              Add to Home Screen
            </Button>
          ) : null}

          {showHowToInstall ? (
            <Button type="button" variant="primary" onClick={() => openGuidance("browser")}>
              How to install
            </Button>
          ) : null}

          <Button type="button" variant="secondary" onClick={handleDismiss}>
            Later
          </Button>
        </div>
      ) : null}

      <PwaInstallGuidance
        open={guidanceOpen}
        kind={guidanceKind}
        alreadyInstalled={runningStandalone}
        onClose={() => setGuidanceOpen(false)}
      />
    </div>
  );
}
