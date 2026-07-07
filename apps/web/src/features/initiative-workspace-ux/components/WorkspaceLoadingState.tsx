export function WorkspaceLoadingState({ message }: { message: string }) {
  return (
    <div className="workspace-loading" role="status" aria-live="polite">
      <p className="workspace-loading__title">Loading</p>
      <p className="workspace-loading__message">{message}</p>
    </div>
  );
}
