export interface WorkspaceEmptyStateProps {
  title: string;
  explanation: string;
  nextStep: string;
}

export function WorkspaceEmptyState({ title, explanation, nextStep }: WorkspaceEmptyStateProps) {
  return (
    <article className="workspace-empty">
      <h3 className="workspace-empty__title">{title}</h3>
      <p className="workspace-empty__explanation">{explanation}</p>
      <p className="workspace-empty__next-step">{nextStep}</p>
    </article>
  );
}
