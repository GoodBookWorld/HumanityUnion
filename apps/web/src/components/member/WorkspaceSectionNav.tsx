"use client";

import { useMemo } from "react";

import { useWorkspaceSectionTracker } from "../../features/workspace-civic-assistant/use-workspace-section-tracker";

/**
 * Section nav identity: stable DOM hash id (never derived from translated labels).
 * `label` is participant-visible WEB_UI copy only.
 */
export type WorkspaceNavSection =
  | string
  | {
      readonly id: string;
      readonly label: string;
    };

export function normalizeWorkspaceNavSection(section: WorkspaceNavSection): {
  readonly id: string;
  readonly label: string;
} {
  if (typeof section === "string") {
    return {
      id: `section-${section.replace(/\s+/g, "-").toLowerCase()}`,
      label: section,
    };
  }
  return section;
}

interface WorkspaceSectionNavProps {
  sections: readonly WorkspaceNavSection[];
  /** Localized "Sections" heading. */
  sectionsLabel?: string;
  /** Localized aria-label for the section list. */
  sectionsAriaLabel?: string;
}

export function WorkspaceSectionNav({
  sections,
  sectionsLabel = "Sections",
  sectionsAriaLabel = "Initiative workspace sections",
}: WorkspaceSectionNavProps) {
  // Keep a stable array reference when `sections` is unchanged so the tracker
  // does not tear down IntersectionObserver on every parent render.
  const normalized = useMemo(
    () => sections.map(normalizeWorkspaceNavSection),
    [sections],
  );
  const currentSectionId = useWorkspaceSectionTracker(normalized);

  return (
    <>
      <p className="member-workspace__nav-label">{sectionsLabel}</p>
      <nav className="member-workspace__nav-list" aria-label={sectionsAriaLabel}>
        {normalized.map((item) => {
          const isActive = currentSectionId === item.id;

          return (
            <a
              key={item.id}
              className={`member-workspace__nav-link${isActive ? " member-workspace__nav-link--active" : ""}`}
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
