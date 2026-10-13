"use client";

import { useTranslations } from "next-intl";

import "./profile-section.css";

interface ProfileSectionProps {
  title: string;
  id?: string;
  children?: React.ReactNode;
  placeholder?: boolean;
  headingAccessory?: React.ReactNode;
}

export function ProfileSection({
  title,
  id,
  children,
  placeholder = false,
  headingAccessory,
}: ProfileSectionProps) {
  const t = useTranslations("common");
  const sectionId = id ?? title.replace(/\s+/g, "-").toLowerCase();
  const heading = (
    <h2 className="profile-section__title" id={`section-${sectionId}`}>
      {title}
    </h2>
  );

  return (
    <section className="profile-section" id={sectionId} aria-labelledby={`section-${sectionId}`}>
      {headingAccessory ? (
        <div className="profile-section__heading">
          {heading}
          {headingAccessory}
        </div>
      ) : (
        heading
      )}
      {placeholder ? (
        <p className="profile-section__placeholder">{t("comingSoon")}</p>
      ) : (
        children
      )}
    </section>
  );
}
