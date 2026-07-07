import type { ReactNode } from "react";

interface NotificationCardProps {
  children: ReactNode;
}

export function NotificationCard({ children }: NotificationCardProps) {
  return <article className="hu-notification-card">{children}</article>;
}
