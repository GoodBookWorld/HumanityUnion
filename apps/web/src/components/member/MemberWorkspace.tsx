import "./member-workspace.css";

interface MemberWorkspaceProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function MemberWorkspace({ title, subtitle, children }: MemberWorkspaceProps) {
  return (
    <div className="member-workspace">
      <aside className="member-workspace__nav" aria-label="Workspace navigation">
        <p className="member-workspace__nav-label">Workspace</p>
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
