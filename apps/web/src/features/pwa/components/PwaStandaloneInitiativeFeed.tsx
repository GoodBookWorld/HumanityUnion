"use client";

import { useEffect, useState } from "react";

import {
  resolvePresentationMode,
  subscribePresentationMode,
} from "../presentation-mode";
import { PwaInitiativeFeed } from "./PwaInitiativeFeed";

/** Surfaces the Initiative Feed prominently in installed standalone mode only. */
export function PwaStandaloneInitiativeFeed() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sync = (mode: "browser" | "standalone") => {
      setStandalone(mode === "standalone");
    };
    sync(resolvePresentationMode());
    return subscribePresentationMode(sync);
  }, []);

  if (!standalone) {
    return null;
  }

  return (
    <section className="workspace-home-section" aria-label="Initiative feed">
      <PwaInitiativeFeed />
    </section>
  );
}
