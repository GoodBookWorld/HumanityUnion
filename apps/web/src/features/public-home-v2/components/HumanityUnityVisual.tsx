"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { HUMANITY_UNITY_BACKGROUND_SRC } from "../hero-unity-visual.constants";
import { HumanityTypewriterQuote } from "./HumanityTypewriterQuote";

import "./hero-unity-visual.css";

/**
 * Right-column Home hero visual.
 * Quote is CSS-animated (SSR-safe). Globe is client-only and skipped ≤768px.
 */
const HumanityGlobe = dynamic(
  () => import("./HumanityGlobe").then((module) => module.HumanityGlobe),
  {
    ssr: false,
    loading: () => null,
  },
);

const DESKTOP_VISUAL_QUERY = "(min-width: 769px)";

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
      <div
        className="hero-unity-visual__background"
        style={{ backgroundImage: `url(${HUMANITY_UNITY_BACKGROUND_SRC})` }}
        aria-hidden="true"
      />
      <div className="hero-unity-visual__content">
        <div className="hero-unity-visual__globe-slot">
          {mountGlobe ? <HumanityGlobe /> : null}
        </div>
        <HumanityTypewriterQuote />
      </div>
    </aside>
  );
}
