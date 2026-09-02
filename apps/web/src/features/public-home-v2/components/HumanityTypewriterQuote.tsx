/**
 * Multiline adaptive quote for the Home Hero visual panel.
 *
 * Pack 08I.3 — quote comes from published Brand Localization (manual per locale).
 * - One stable accessible string for assistive tech.
 * - Visual lines follow Admin newlines when present; otherwise a single wrapping line.
 * - Visibility is owned by the honeycomb mask (no independent quote show/hide).
 */
"use client";

import {
  accessibleHeroUnityQuote,
  visualHeroUnityQuoteLines,
} from "@hu/types";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

export function HumanityTypewriterQuote() {
  const brand = useLocalizedBrand();
  const quote = brand.heroUnityQuote;
  const accessible = accessibleHeroUnityQuote(quote) || quote.trim();
  const lines = visualHeroUnityQuoteLines(quote);

  return (
    <div className="hero-unity-quote" data-hero-quote-stable="true">
      <p className="hero-unity-quote__sr-only">{accessible}</p>
      <div className="hero-unity-quote__visual" aria-hidden="true">
        {lines.map((line, index) => {
          const lineClass =
            lines.length === 3
              ? `hero-unity-quote__line hero-unity-quote__line--${index + 1}`
              : "hero-unity-quote__line hero-unity-quote__line--wrap";
          return (
            <div key={`quote-line-${index + 1}`} className={lineClass}>
              <span className="hero-unity-quote__line-text">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
