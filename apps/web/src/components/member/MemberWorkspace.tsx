import { WorkspaceSectionNav } from "./WorkspaceSectionNav";

import "./member-workspace.css";

interface MemberWorkspaceProps {
  title: string;
  subtitle?: string;
  navItems?: readonly string[];
  workspaceNavigation?: React.ReactNode;
  headerBar?: React.ReactNode;
  assistant?: React.ReactNode;
  /**
   * Pack 14C — `rail` keeps the classic side column.
   * `compact` places Assistant above content so long-form editors are not permanently compressed.
   */
  assistantPlacement?: "rail" | "compact";
  children: React.ReactNode;
}

export function MemberWorkspace({
  title,
  subtitle,
  navItems,
  workspaceNavigation,
  headerBar,
  assistant,
  assistantPlacement = "rail",
  children,
}: MemberWorkspaceProps) {
  const withAssistantRail = Boolean(assistant) && assistantPlacement === "rail";
  const withAssistantCompact = Boolean(assistant) && assistantPlacement === "compact";

  return (
    <div
      className={`member-workspace${withAssistantRail ? " member-workspace--with-assistant" : ""}`}
    >
      <aside className="member-workspace__nav" aria-label="Workspace navigation">
        {workspaceNavigation}
        {navItems ? <WorkspaceSectionNav sections={navItems} /> : null}
      </aside>
      <div className="member-workspace__main">
        {headerBar ? (
          headerBar
        ) : withAssistantCompact ? (
          <header className="member-workspace__header member-workspace__header--with-assistant">
            <div className="member-workspace__header-copy">
              <h1 className="member-workspace__title">{title}</h1>
              {subtitle ? <p className="member-workspace__subtitle">{subtitle}</p> : null}
            </div>
            <div className="member-workspace__assistant-compact">{assistant}</div>
          </header>
        ) : (
          <header className="member-workspace__header">
            <h1 className="member-workspace__title">{title}</h1>
            {subtitle ? <p className="member-workspace__subtitle">{subtitle}</p> : null}
          </header>
        )}
        {withAssistantRail ? (
          <div className="member-workspace__content-grid">
            <div className="member-workspace__content">{children}</div>
            {assistant}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
