import type { ReactNode } from "react";

export function WorkspaceRecordList({ children }: { children: ReactNode }) {
  return <ul className="workspace-record-list">{children}</ul>;
}

interface WorkspaceRecordItemProps {
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
}

export function WorkspaceRecordItem({ title, meta, body }: WorkspaceRecordItemProps) {
  return (
    <li className="workspace-record-item">
      <div className="workspace-record-item__title">{title}</div>
      {meta ? <p className="workspace-record-item__meta">{meta}</p> : null}
      {body ? <p className="workspace-record-item__body">{body}</p> : null}
    </li>
  );
}
