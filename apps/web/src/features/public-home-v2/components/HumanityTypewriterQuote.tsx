import type { CSSProperties } from "react";

import {
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
  HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS,
} from "../hero-unity-visual.constants";

/**
 * Multiline adaptive quote for the Home Hero visual panel.
 *
 * - One stable accessible string for assistive tech.
 * - Three semantic visual lines (English composition).
 * - Lines wrap internally for longer translations; container grows upward.
 * - Sequential CSS opacity reveal (translation-safe; no width clipping).
 */
export function HumanityTypewriterQuote() {
  const style = {
    "--hero-unity-quote-cycle": `${HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS}s`,
  } as CSSProperties;

  return (
    <div className="hero-unity-quote" style={style}>
      <p className="hero-unity-quote__sr-only">{HUMANITY_UNITY_QUOTE}</p>
      <div className="hero-unity-quote__visual" aria-hidden="true">
        {HUMANITY_UNITY_QUOTE_LINES.map((line, index) => (
          <div
            key={`quote-line-${index + 1}`}
            className={`hero-unity-quote__line hero-unity-quote__line--${index + 1}`}
          >
            <span className="hero-unity-quote__line-text">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
