/**
 * ICU 4.8 apostrophe-friendly quoting for WEB_UI structure inspection/protection.
 *
 * Matches `@formatjs/icu-messageformat-parser` / next-intl runtime:
 * an ASCII apostrophe starts a quoted section only when it immediately precedes
 * a character that requires quoting (`{`, `}`, `<`, `>`, or `#` inside plural).
 * `''` is always one literal apostrophe. Contractions (`couldn't`) stay literal.
 *
 * @see https://unicode-org.github.io/icu/userguide/format_parse/messages/
 */

export type IcuApostropheAdvance = {
  /** Index after the apostrophe construct. */
  readonly nextIndex: number;
  /**
   * True when `'` … `'` quoted a syntax run (braces/tags inside are literal).
   * False for a lone literal `'` or a `''` escape.
   */
  readonly quotedSyntax: boolean;
};

/**
 * Advance past an apostrophe at `index` using ICU 4.8 “only where needed” rules.
 * Caller must ensure `input[index] === "'"`.
 */
export function advanceIcuApostropheFriendly(
  input: string,
  index: number,
  options?: { readonly numberSignRequiresQuote?: boolean },
): IcuApostropheAdvance {
  const next = input[index + 1];
  if (next === "'") {
    return { nextIndex: index + 2, quotedSyntax: false };
  }
  const requiresQuote =
    next === "{" ||
    next === "}" ||
    next === "<" ||
    next === ">" ||
    (next === "#" && options?.numberSignRequiresQuote === true);
  if (!requiresQuote) {
    return { nextIndex: index + 1, quotedSyntax: false };
  }
  // Opening quote consumed; copy/skip quoted body until closing apostrophe.
  let cursor = index + 2;
  while (cursor < input.length) {
    if (input[cursor] === "'") {
      if (input[cursor + 1] === "'") {
        cursor += 2;
        continue;
      }
      return { nextIndex: cursor + 1, quotedSyntax: true };
    }
    cursor += 1;
  }
  // Unclosed quote: remainder is quoted (FormatJS behavior).
  return { nextIndex: input.length, quotedSyntax: true };
}
