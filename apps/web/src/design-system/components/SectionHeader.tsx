interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Optional id for the title heading (aria-labelledby targets). */
  titleId?: string;
}

export function SectionHeader({ title, description, titleId }: SectionHeaderProps) {
  return (
    <header className="hu-section-header">
      <h2 id={titleId} className="hu-section-header__title">
        {title}
      </h2>
      {description ? <p className="hu-section-header__description">{description}</p> : null}
    </header>
  );
}
