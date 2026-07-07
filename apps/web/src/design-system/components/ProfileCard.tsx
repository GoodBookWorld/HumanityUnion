import type { ReactNode } from "react";

interface ProfileCardProps {
  title: string;
  children: ReactNode;
}

export function ProfileCard({ title, children }: ProfileCardProps) {
  return (
    <article className="hu-profile-card">
      <h3 className="hu-profile-card__title">{title}</h3>
      {children}
    </article>
  );
}
