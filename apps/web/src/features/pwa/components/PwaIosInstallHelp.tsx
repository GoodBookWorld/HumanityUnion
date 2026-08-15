"use client";

import { PwaInstallGuidance } from "./PwaInstallGuidance";

interface PwaIosInstallHelpProps {
  open: boolean;
  onClose: () => void;
}

/** @deprecated Prefer PwaInstallGuidance — kept for Pack 01 import stability. */
export function PwaIosInstallHelp({ open, onClose }: PwaIosInstallHelpProps) {
  return <PwaInstallGuidance open={open} kind="ios" onClose={onClose} />;
}
