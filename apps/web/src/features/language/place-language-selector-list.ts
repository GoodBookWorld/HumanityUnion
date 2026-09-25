/**
 * Version 5.0 — viewport placement for the branded language list.
 *
 * Historical alignment is the selector's inline-start edge (CSS
 * `inset-inline-start: 0`). Physical `left` is then shifted so neither
 * border leaves the viewport. Direction is LTR/RTL only — no locale offsets.
 *
 * Height is a max of ten measured rows. Fewer rows do not stretch the panel.
 * A short viewport clamps that max so the list stays on screen and scrolls.
 */

export const LANGUAGE_SELECTOR_VISIBLE_ROW_LIMIT = 10;
export const LANGUAGE_SELECTOR_VIEWPORT_MARGIN_PX = 8;
export const LANGUAGE_SELECTOR_LIST_GAP_PX = 4;
/** Matches header mobile breakpoint — center the open list on narrow viewports. */
export const LANGUAGE_SELECTOR_MOBILE_VIEWPORT_MAX_PX = 768;
/** Above sticky header (100) so the first row is never painted under chrome. */
export const LANGUAGE_SELECTOR_OVERLAY_Z_INDEX = 140;

export interface LanguageSelectorListPlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Ceiling only. Do not assign this as `height` — short lists stay content-sized. */
  readonly maxHeight: number;
  readonly opensAbove: boolean;
}

export function placeLanguageSelectorList(input: {
  readonly trigger: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly listWidth: number;
  readonly rowHeight: number;
  readonly rowCount: number;
  /** Padding + border included in the list's border-box max-height. */
  readonly listChrome: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly direction: "ltr" | "rtl";
  readonly margin?: number;
  readonly gap?: number;
  /**
   * `viewport-center` — mobile only: center the panel in the viewport.
   * `trigger` — desktop/tablet: anchor to the trigger, then clamp.
   */
  readonly horizontalAlign?: "trigger" | "viewport-center";
  /**
   * Bottom edge of sticky chrome (website header / PWA app header). The open
   * list must start fully below this so the first row is never covered.
   */
  readonly clearanceTop?: number;
}): LanguageSelectorListPlacement {
  const margin = input.margin ?? LANGUAGE_SELECTOR_VIEWPORT_MARGIN_PX;
  const gap = input.gap ?? LANGUAGE_SELECTOR_LIST_GAP_PX;
  const rowHeight = Math.max(1, input.rowHeight);
  const rowCount = Math.max(0, input.rowCount);
  const chrome = Math.max(0, input.listChrome);
  const viewportWidth = Math.max(0, input.viewportWidth);
  const viewportHeight = Math.max(0, input.viewportHeight);
  const horizontalAlign =
    input.horizontalAlign ??
    (viewportWidth <= LANGUAGE_SELECTOR_MOBILE_VIEWPORT_MAX_PX
      ? "viewport-center"
      : "trigger");
  const clearanceTop = Math.max(0, input.clearanceTop ?? 0);

  const maxWidth = Math.max(0, viewportWidth - margin * 2);
  const width = Math.min(Math.max(0, input.listWidth), maxWidth);

  let left: number;
  if (horizontalAlign === "viewport-center") {
    left = Math.round((viewportWidth - width) / 2);
  } else {
    left =
      input.direction === "rtl" ? input.trigger.right - width : input.trigger.left;
  }
  if (left + width > viewportWidth - margin) {
    left = viewportWidth - margin - width;
  }
  if (left < margin) {
    left = margin;
  }

  const tenRowCap =
    LANGUAGE_SELECTOR_VISIBLE_ROW_LIMIT * rowHeight + chrome;
  const contentCap = rowCount * rowHeight + chrome;

  // Prefer opening below the trigger, and never under sticky chrome.
  const belowAnchor = Math.max(input.trigger.bottom, clearanceTop) + gap;
  const spaceBelow = viewportHeight - margin - belowAnchor;
  const spaceAbove = input.trigger.top - gap - margin;

  // Mobile viewport-center: always open below chrome/trigger so the first row
  // cannot sit under the header. Desktop may flip above when space is tight.
  const opensAbove =
    horizontalAlign !== "viewport-center" &&
    spaceBelow < rowHeight &&
    spaceAbove > spaceBelow;

  let top: number;
  let available: number;
  if (opensAbove) {
    available = Math.max(0, spaceAbove);
    const usedHeight = Math.min(contentCap, tenRowCap, available);
    top = Math.max(margin, input.trigger.top - gap - usedHeight);
    available = Math.max(0, input.trigger.top - gap - top);
  } else {
    top = Math.max(belowAnchor, margin);
    available = Math.max(0, viewportHeight - margin - top);
  }

  const maxHeight = Math.min(tenRowCap, available);

  return { left, top, width, maxHeight, opensAbove };
}

/**
 * Overlay clamp is for the header dropdown (portaled / fixed to the viewport).
 * In-flow mobile/PWA menu lists stay inside their already viewport-bounded panel.
 */
export function languageSelectorUsesOverlayPlacement(className: string | undefined): boolean {
  return !String(className ?? "")
    .split(/\s+/)
    .includes("hu-language-selector--mobile");
}

/** Sticky chrome bottom edge in viewport coordinates (0 when none). */
export function resolveLanguageSelectorClearanceTop(
  doc: ParentNode = typeof document !== "undefined" ? document : (null as never),
): number {
  if (!doc || typeof (doc as Document).querySelector !== "function") {
    return 0;
  }
  const nodes = (doc as Document).querySelectorAll(
    ".humanity-header, .hu-pwa-app-header",
  );
  let bottom = 0;
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return;
    }
    bottom = Math.max(bottom, node.getBoundingClientRect().bottom);
  });
  return bottom;
}

export function syncLanguageSelectorListPlacement(
  list: HTMLElement,
  trigger: HTMLElement,
): void {
  // Measure content width before applying fixed placement. Clear width locks and
  // the base `min-width: max(100%, …)` rule — once portaled to `document.body`,
  // percentage min-width resolves against the viewport and inflates the panel.
  const previousWidth = list.style.width;
  const previousMaxWidth = list.style.maxWidth;
  const previousMinWidth = list.style.minWidth;
  const previousTransform = list.style.transform;
  const previousLeft = list.style.left;
  const previousPosition = list.style.position;
  list.style.position = "fixed";
  list.style.left = "-9999px";
  list.style.width = "max-content";
  list.style.maxWidth = "none";
  list.style.minWidth = "11rem";
  list.style.transform = "";
  const naturalWidth = list.getBoundingClientRect().width;
  list.style.width = previousWidth;
  list.style.maxWidth = previousMaxWidth;
  list.style.minWidth = previousMinWidth;
  list.style.transform = previousTransform;
  list.style.left = previousLeft;
  list.style.position = previousPosition;
  if (naturalWidth <= 0) {
    return;
  }

  const option = list.querySelector<HTMLElement>(".hu-language-selector__option");
  const rowHeight = option?.getBoundingClientRect().height || 36;
  const rowCount = list.querySelectorAll(".hu-language-selector__option").length;
  const style = getComputedStyle(list);
  const listChrome =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth);
  const direction = getComputedStyle(trigger).direction === "rtl" ? "rtl" : "ltr";
  const triggerRect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const margin = LANGUAGE_SELECTOR_VIEWPORT_MARGIN_PX;
  const viewportCenter = viewportWidth <= LANGUAGE_SELECTOR_MOBILE_VIEWPORT_MAX_PX;
  const clearanceTop = resolveLanguageSelectorClearanceTop(document);
  const placed = placeLanguageSelectorList({
    trigger: triggerRect,
    listWidth: naturalWidth,
    rowHeight,
    rowCount,
    listChrome: Number.isFinite(listChrome) ? listChrome : 0,
    viewportWidth,
    viewportHeight: window.innerHeight,
    direction,
    margin,
    horizontalAlign: viewportCenter ? "viewport-center" : "trigger",
    clearanceTop,
  });

  list.style.position = "fixed";
  list.style.top = `${placed.top}px`;
  list.style.width = `${placed.width}px`;
  list.style.minWidth = "0";
  list.style.maxHeight = `${placed.maxHeight}px`;
  list.style.right = "auto";
  list.style.bottom = "auto";
  list.style.insetInlineStart = "auto";
  list.style.insetInlineEnd = "auto";
  list.style.margin = "0";
  list.style.boxSizing = "border-box";
  list.style.overflowX = "hidden";
  list.style.overflowY = "auto";
  list.style.zIndex = String(LANGUAGE_SELECTOR_OVERLAY_Z_INDEX);
  // Fresh open: start at the intended list position (first rows visible).
  list.scrollTop = 0;

  if (viewportCenter) {
    // Viewport-relative centering: vw units + self-centered translate. Must be
    // paired with a true viewport containing block (list portaled to body).
    list.style.left = "50vw";
    list.style.transform = "translateX(-50%)";
    list.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
  } else {
    list.style.left = `${placed.left}px`;
    list.style.transform = "";
    list.style.maxWidth = `${placed.width}px`;
  }
}
