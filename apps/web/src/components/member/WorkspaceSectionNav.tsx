"use client";

import { useWorkspaceSectionTracker } from "../../features/workspace-civic-assistant/use-workspace-section-tracker";

function toSectionId(title: string): string {
  return `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
}

interface WorkspaceSectionNavProps {
  sections: readonly string[];
}

export function WorkspaceSectionNav({ sections }: WorkspaceSectionNavProps) {
  const currentSection = useWorkspaceSectionTracker(sections);

  return (
    <>
      <p className="member-workspace__nav-label">Sections</p>
      <nav className="member-workspace__nav-list" aria-label="Initiative workspace sections">
        {sections.map((item) => {
          const isActive = currentSection === item;

          return (
            <a
              key={item}
              className={`member-workspace__nav-link${isActive ? " member-workspace__nav-link--active" : ""}`}
              href={`#${toSectionId(item)}`}
              aria-current={isActive ? "true" : undefined}
            >
              {item}
            </a>
          );
        })}
      </nav>
    </>
  );
}
