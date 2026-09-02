/**
 * Pack 22I.1 / 22I.2 — branded PWA launch overlay (logo + HU Matrix Reveal).
 * Pack 22I.2 — interactive HU logo Sound fallback when autoplay is blocked.
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { HuMatrixReveal } from "../hu-matrix-reveal";
import { playPwaLaunchAudioFromUserGesture } from "../pwa-launch-audio";
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
  const tPwa = useTranslations("pwa");
  const authStatus = useClientAuthStatus();
  const launch = usePwaLaunchSequence({
    authStatus,
    standalone: props.standalone,
    prefersReducedMotion: props.prefersReducedMotion,
    enableAudio: props.enableAudio,
    matrixSeed: props.matrixSeed,
  });
  const [soundActivating, setSoundActivating] = useState(false);

  if (!launch.active) {
    return null;
  }

  const showMatrix =
    !launch.reducedMotion &&
    (launch.phase === "reveal" || launch.phase === "finishing");

  const soundFallback =
    launch.audioStatus === "gesture_required" && !soundActivating;

  const logoStyle = {
    opacity: launch.logoOpacity,
    transform: `scale(${launch.logoScale})`,
  };

  const logoImage = (
    <img
      className="hu-pwa-launch__logo"
      src={PWA_LAUNCH_LOGO_SRC}
      alt=""
      width={160}
      height={160}
      draggable={false}
      style={soundFallback ? undefined : logoStyle}
    />
  );

  const onPlaySound = () => {
    if (!soundFallback || soundActivating) {
      return;
    }
    setSoundActivating(true);
    void playPwaLaunchAudioFromUserGesture().finally(() => {
      setSoundActivating(false);
    });
  };

  return (
    <div
      className="hu-pwa-launch"
      style={{
        zIndex: PWA_LAUNCH_Z_INDEX,
        opacity: launch.overlayOpacity,
        backgroundColor: showMatrix ? "transparent" : PWA_LAUNCH_BACKDROP,
        pointerEvents: "auto",
      }}
      aria-hidden={soundFallback ? undefined : true}
      data-hu-pwa-launch-phase={launch.phase}
      data-hu-pwa-launch-sound={soundFallback ? "fallback" : "off"}
    >
      {showMatrix ? (
        <HuMatrixReveal
          active
          progress={launch.revealProgress}
          seed={launch.matrixSeed}
        />
      ) : null}
      <div className="hu-pwa-launch__logo-wrap" style={soundFallback ? logoStyle : undefined}>
        {soundFallback ? (
          <button
            type="button"
            className="hu-pwa-launch__logo-sound"
            aria-label={tPwa("playIntroSound")}
            onClick={onPlaySound}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPlaySound();
              }
            }}
          >
            {logoImage}
            <span className="hu-pwa-launch__sound-badge" aria-hidden="true">
              <span className="hu-pwa-launch__sound-icon">♪</span>
              <span className="hu-pwa-launch__sound-label">{tPwa("sound")}</span>
            </span>
          </button>
        ) : (
          logoImage
        )}
      </div>
    </div>
  );
}
