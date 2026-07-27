import { Button } from "../../../design-system";

import type { CSSProperties, ReactNode } from "react";

interface PublicHomeResourceSectionProps {
  id: string;
  title: string;
  intro: string;
  backgroundImage: string;
  toneClass: "media" | "archive";
  children: ReactNode;
}

export function PublicHomeResourceSection({
  id,
  title,
  intro,
  backgroundImage,
  toneClass,
  children,
}: PublicHomeResourceSectionProps) {
  return (
    <section
      className={`public-home-v2__section public-home-v2__section--resource public-home-v2__section--resource-${toneClass}`}
      aria-labelledby={id}
      style={
        {
          "--public-home-resource-image": `url("${backgroundImage}")`,
        } as CSSProperties
      }
    >
      <div className="public-home-v2__resource-layout">
        <div className="public-home-v2__resource-content">
          <h2 id={id}>{title}</h2>
          <p className="public-home-v2__section-intro">{intro}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function PublicHomeResourceActions({ children }: { children: React.ReactNode }) {
  return <div className="public-home-v2__section-actions">{children}</div>;
}

export function PublicHomeResourcePrimaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button href={href} variant="primary">
      {children}
    </Button>
  );
}

export function PublicHomeResourceSecondaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button href={href} variant="secondary">
      {children}
    </Button>
  );
}
