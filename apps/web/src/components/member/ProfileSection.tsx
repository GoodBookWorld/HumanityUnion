import "./profile-section.css";

interface ProfileSectionProps {
  title: string;
  children?: React.ReactNode;
  placeholder?: boolean;
}

export function ProfileSection({ title, children, placeholder = false }: ProfileSectionProps) {
  return (
    <section className="profile-section" aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <h2 className="profile-section__title" id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}>
        {title}
      </h2>
      {placeholder ? <p className="profile-section__placeholder">Coming soon</p> : children}
    </section>
  );
}
