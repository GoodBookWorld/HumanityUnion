"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX } from "../hero-unity-visual.constants";
import { HumanityTypewriterQuote } from "./HumanityTypewriterQuote";

import "./hero-unity-visual.css";

/**
 * Right-column Home hero visual.
 * Quote is CSS-animated (SSR-safe). Honeycomb + signals are client-only (≥769px).
 */
const HumanityGlobe = dynamic(
  () => import("./HumanityGlobe").then((module) => module.HumanityGlobe),
  {
    ssr: false,
    loading: () => null,
  },
);

const DESKTOP_VISUAL_QUERY = `(min-width: ${HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX}px)`;

export function HumanityUnityVisual() {
  const [mountGlobe, setMountGlobe] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_VISUAL_QUERY);
    const sync = () => {
      setMountGlobe(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  return (
    <aside
      className="hero-unity-visual"
      aria-label="Humanity unity illustration"
    >
      {/* Soft atmosphere only — no legacy unity-globe background asset. */}
      <div className="hero-unity-visual__background" aria-hidden="true" />
      <div className="hero-unity-visual__stage">
        <div className="hero-unity-visual__quote-layer">
          <HumanityTypewriterQuote />
        </div>
        {mountGlobe ? (
          <div className="hero-unity-visual__overlay-slot">
            <HumanityGlobe />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
