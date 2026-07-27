import "./profile-section.css";

interface ProfileSectionProps {
  title: string;
  id?: string;
  children?: React.ReactNode;
  placeholder?: boolean;
}

export function ProfileSection({ title, id, children, placeholder = false }: ProfileSectionProps) {
  const sectionId = id ?? title.replace(/\s+/g, "-").toLowerCase();

  return (
    <section className="profile-section" id={sectionId} aria-labelledby={`section-${sectionId}`}>
      <h2 className="profile-section__title" id={`section-${sectionId}`}>
        {title}
      </h2>
      {placeholder ? <p className="profile-section__placeholder">Coming soon</p> : children}
    </section>
  );
}
