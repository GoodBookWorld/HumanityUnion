export function WorkspaceErrorState({ message }: { message: string }) {
  return (
    <div className="workspace-error" role="alert">
      <p className="workspace-error__title">Unable to load section</p>
      <p className="workspace-error__message">{message}</p>
    </div>
  );
}
