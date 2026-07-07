import type { ButtonHTMLAttributes } from "react";

type WorkspaceButtonVariant = "primary" | "secondary" | "danger" | "disabled";

interface WorkspaceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WorkspaceButtonVariant;
}

export function WorkspaceButton({
  variant = "secondary",
  className,
  ...props
}: WorkspaceButtonProps) {
  const classes = ["workspace-button", `workspace-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <button type="button" className={classes} {...props} />;
}
