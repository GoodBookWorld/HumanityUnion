import type { ReactNode } from "react";

export function WorkspaceTimeline({ children }: { children: ReactNode }) {
  return <ul className="workspace-timeline">{children}</ul>;
}

interface WorkspaceTimelineItemProps {
  date?: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  links?: ReactNode;
}

export function WorkspaceTimelineItem({
  date,
  title,
  meta,
  body,
  links,
}: WorkspaceTimelineItemProps) {
  return (
    <li className="workspace-timeline__item">
      {date ? <p className="workspace-timeline__date">{date}</p> : null}
      <div className="workspace-timeline__title">{title}</div>
      {meta ? <p className="workspace-timeline__meta">{meta}</p> : null}
      {body ? <p className="workspace-timeline__body">{body}</p> : null}
      {links ? <div className="workspace-timeline__links">{links}</div> : null}
    </li>
  );
}
