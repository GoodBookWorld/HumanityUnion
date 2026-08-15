"use client";

import { useEffect } from "react";

import {
  setDeferredInstallPrompt,
  type BeforeInstallPromptLike,
} from "../install-state";

/**
 * Registers the Pack 01 service worker and captures Chromium install prompt.
 * Never auto-invokes installation.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure must not break the app shell.
    });

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptLike);
    }

    function onAppInstalled() {
      setDeferredInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
