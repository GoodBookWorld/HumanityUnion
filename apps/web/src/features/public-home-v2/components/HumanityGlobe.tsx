/**
 * Home hero decorative overlay: honeycomb mask + foreground signal points.
 * Quote underlay lives in HumanityUnityVisual; this layer never renders Earth/orbits.
 */
"use client";

import { HeroQuoteHoneycombVisual } from "./HeroQuoteHoneycombVisual";

export function HumanityGlobe() {
  return <HeroQuoteHoneycombVisual />;
}
