/**
 * Multiline adaptive quote for the Home Hero visual panel.
 *
 * - One stable accessible string for assistive tech.
 * - Three semantic visual lines (English composition).
 * - Lines wrap internally for longer translations; container grows upward.
 * - Visibility is owned by the honeycomb mask (no independent quote show/hide).
 */
import {
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
} from "../hero-unity-visual.constants";

export function HumanityTypewriterQuote() {
  return (
    <div className="hero-unity-quote" data-hero-quote-stable="true">
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
