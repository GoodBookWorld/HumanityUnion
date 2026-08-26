/**
 * Pack 22I.1 — branded PWA launch overlay (logo + HU Matrix Reveal).
 */
"use client";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { HuMatrixReveal } from "../hu-matrix-reveal";
import {
  PWA_LAUNCH_BACKDROP,
  PWA_LAUNCH_LOGO_SRC,
  PWA_LAUNCH_Z_INDEX,
} from "../pwa-launch-constants";
import { usePwaLaunchSequence } from "../use-pwa-launch-sequence";

export interface PwaLaunchSequenceProps {
  /** Force standalone for tests / Storybook. */
  readonly standalone?: boolean;
  readonly prefersReducedMotion?: boolean;
  readonly enableAudio?: boolean;
  readonly matrixSeed?: number;
}

export function PwaLaunchSequence(props: PwaLaunchSequenceProps = {}) {
  const authStatus = useClientAuthStatus();
  const launch = usePwaLaunchSequence({
    authStatus,
    standalone: props.standalone,
    prefersReducedMotion: props.prefersReducedMotion,
    enableAudio: props.enableAudio,
    matrixSeed: props.matrixSeed,
  });

  if (!launch.active) {
    return null;
  }

  const showMatrix =
    !launch.reducedMotion &&
    (launch.phase === "reveal" || launch.phase === "finishing");

  return (
    <div
      className="hu-pwa-launch"
      style={{
        zIndex: PWA_LAUNCH_Z_INDEX,
        opacity: launch.overlayOpacity,
        backgroundColor: showMatrix ? "transparent" : PWA_LAUNCH_BACKDROP,
        pointerEvents: "auto",
      }}
      aria-hidden="true"
      data-hu-pwa-launch-phase={launch.phase}
    >
      {showMatrix ? (
        <HuMatrixReveal
          active
          progress={launch.revealProgress}
          seed={launch.matrixSeed}
        />
      ) : null}
      <div className="hu-pwa-launch__logo-wrap">
        <img
          className="hu-pwa-launch__logo"
          src={PWA_LAUNCH_LOGO_SRC}
          alt=""
          width={160}
          height={160}
          draggable={false}
          style={{
            opacity: launch.logoOpacity,
            transform: `scale(${launch.logoScale})`,
          }}
        />
      </div>
    </div>
  );
}
