"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  resolvePresentationMode,
  subscribePresentationMode,
  type HuPresentationMode,
} from "../presentation-mode";
import { PwaAppHeader } from "./PwaAppHeader";
import { PwaBottomNav } from "./PwaBottomNav";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

interface PwaShellProps {
  children: ReactNode;
}

/**
 * Standalone presentation shell — App Header + Bottom Nav only when installed.
 * Browser mode keeps the website chrome from HumanityLayout.
 */
export function PwaShell({ children }: PwaShellProps) {
  const [mode, setMode] = useState<HuPresentationMode>("browser");

  useEffect(() => {
    const apply = (next: HuPresentationMode) => {
      setMode(next);
      document.body.classList.toggle("humanity-app--pwa-standalone", next === "standalone");
    };

    apply(resolvePresentationMode());
    return subscribePresentationMode(apply);
  }, []);

  const standalone = mode === "standalone";

  return (
    <>
      <ServiceWorkerRegister />
      {standalone ? <PwaAppHeader /> : null}
      {children}
      {standalone ? <PwaBottomNav /> : null}
    </>
  );
}
