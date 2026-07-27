import { WorkspaceSectionNav } from "./WorkspaceSectionNav";

import "./member-workspace.css";

interface MemberWorkspaceProps {
  title: string;
  subtitle?: string;
  navItems?: readonly string[];
  workspaceNavigation?: React.ReactNode;
  headerBar?: React.ReactNode;
  assistant?: React.ReactNode;
  children: React.ReactNode;
}

export function MemberWorkspace({
  title,
  subtitle,
  navItems,
  workspaceNavigation,
  headerBar,
  assistant,
  children,
}: MemberWorkspaceProps) {
  return (
    <div className={`member-workspace${assistant ? " member-workspace--with-assistant" : ""}`}>
      <aside className="member-workspace__nav" aria-label="Workspace navigation">
        {workspaceNavigation}
        {navItems ? <WorkspaceSectionNav sections={navItems} /> : null}
      </aside>
      <div className="member-workspace__main">
        {headerBar ? (
          headerBar
        ) : (
          <header className="member-workspace__header">
            <h1 className="member-workspace__title">{title}</h1>
            {subtitle ? <p className="member-workspace__subtitle">{subtitle}</p> : null}
          </header>
        )}
        {assistant ? (
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
