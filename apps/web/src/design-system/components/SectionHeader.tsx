interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <header className="hu-section-header">
      <h2 className="hu-section-header__title">{title}</h2>
      {description ? <p className="hu-section-header__description">{description}</p> : null}
    </header>
  );
}
