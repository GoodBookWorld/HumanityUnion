/**
 * Native/system share is an explicit channel on touch/narrow viewports.
 * Desktop fine-pointer surfaces open the civic popover only — never
 * auto-invoke `navigator.share` from the main Share trigger.
 */
export function shouldOfferNativeShareShortcut(
  input: {
    readonly viewportWidth?: number;
    readonly pointerCoarse?: boolean;
  } = {},
): boolean {
  const width =
    input.viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1024);
  const coarse =
    input.pointerCoarse ??
    (typeof window !== "undefined"
      ? window.matchMedia("(pointer: coarse)").matches
      : false);
  return coarse || width < 768;
}
