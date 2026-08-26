"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  resolvePresentationMode,
  subscribePresentationMode,
  type HuPresentationMode,
} from "../presentation-mode";
import { clearPwaLaunchFirstPaintPending } from "../pwa-launch-first-paint";
import { hasPwaLaunchPlayedThisSession } from "../pwa-launch-session";
import { PwaAppHeader } from "./PwaAppHeader";
import { PwaBottomNav } from "./PwaBottomNav";
import { PwaLaunchSequence } from "./PwaLaunchSequence";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

interface PwaShellProps {
  children: ReactNode;
}

/**
 * Standalone presentation shell — App Header + Bottom Nav only when installed.
 * Browser mode keeps the website chrome from HumanityLayout.
 * Pack 22I.1 — branded launch overlay mounts only in standalone PWA sessions.
 * Pack 22I.2 — sync standalone detection on first client render (no post-effect flash).
 */
export function PwaShell({ children }: PwaShellProps) {
  // Pack 22I.2 — resolve on first client render; SSR stays "browser" (no cover in HTML).
  const [mode, setMode] = useState<HuPresentationMode>(() => resolvePresentationMode());

  useEffect(() => {
    const apply = (next: HuPresentationMode) => {
      setMode(next);
      document.body.classList.toggle("humanity-app--pwa-standalone", next === "standalone");
      // Browser / already-played sessions must never keep a stuck first-paint cover.
      if (next !== "standalone" || hasPwaLaunchPlayedThisSession()) {
        clearPwaLaunchFirstPaintPending();
      }
    };

    apply(resolvePresentationMode());
    return subscribePresentationMode(apply);
  }, []);

  const standalone = mode === "standalone";

  return (
    <>
      <ServiceWorkerRegister />
      {standalone ? <PwaLaunchSequence standalone /> : null}
      {standalone ? <PwaAppHeader /> : null}
      {children}
      {standalone ? <PwaBottomNav /> : null}
    </>
  );
}
