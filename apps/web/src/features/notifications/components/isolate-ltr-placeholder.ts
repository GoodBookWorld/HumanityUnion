/**
 * Split a catalog template at one `{name}` placeholder and mark that value LTR.
 * Placeholder position follows the translated string. Catalog text is not rewritten.
 */

export type IsolatedPlaceholderPart =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "ltr"; readonly text: string };

export function isolateLtrPlaceholder(
  template: string,
  placeholder: string,
  value: string,
): readonly IsolatedPlaceholderPart[] {
  const token = `{${placeholder}}`;
  if (!template.includes(token)) {
    return [{ type: "text", text: template }];
  }

  const pieces = template.split(token);
  const parts: IsolatedPlaceholderPart[] = [];
  pieces.forEach((piece, index) => {
    if (piece.length > 0) {
      parts.push({ type: "text", text: piece });
    }
    if (index < pieces.length - 1) {
      parts.push({ type: "ltr", text: value });
    }
  });
  return parts;
}
