import "./member-workspace.css";

interface MemberWorkspaceProps {
  title: string;
  subtitle?: string;
  navItems?: string[];
  children: React.ReactNode;
}

function toSectionId(title: string): string {
  return `section-${title.replace(/\s+/g, "-").toLowerCase()}`;
}

export function MemberWorkspace({ title, subtitle, navItems, children }: MemberWorkspaceProps) {
  return (
    <div className="member-workspace">
      <aside className="member-workspace__nav" aria-label="Workspace navigation">
        <p className="member-workspace__nav-label">Workspace</p>
        {navItems ? (
          <nav className="member-workspace__nav-list">
            {navItems.map((item) => (
              <a key={item} className="member-workspace__nav-link" href={`#${toSectionId(item)}`}>
                {item}
              </a>
            ))}
          </nav>
        ) : null}
      </aside>
      <div className="member-workspace__main">
        <header className="member-workspace__header">
          <h1 className="member-workspace__title">{title}</h1>
          {subtitle ? <p className="member-workspace__subtitle">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
