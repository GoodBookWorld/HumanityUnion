/**
 * Launch Readiness Pack 05 — shared keyboard focus helpers for dialogs/menus.
 * Keeps Tab/Shift+Tab cycling inside a container without inventing a new modal framework.
 */

function isFocusableCandidate(element: HTMLElement): boolean {
  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (element.closest("[hidden]")) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return true;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(isFocusableCandidate);
}

/** Cycle Tab/Shift+Tab within `container`. Returns true when the event was handled. */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== "Tab") {
    return false;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    if (container.tabIndex < 0) {
      container.tabIndex = -1;
    }
    container.focus();
    return true;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  if (active instanceof HTMLElement && !container.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return true;
  }

  return false;
}
