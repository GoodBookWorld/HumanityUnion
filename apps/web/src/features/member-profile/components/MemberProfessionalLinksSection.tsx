"use client";

import { Button } from "../../../design-system/components/Button";
import { resolveSaveButtonLabel, type SaveButtonPhase } from "../use-save-button-phase";

import "./member-professional-links.css";

/** Pack 17E — personal Participant professional / social link fields. */
export interface MemberProfessionalLinksValues {
  website?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
}

const PROFESSIONAL_LINK_FIELDS: readonly {
  key: keyof MemberProfessionalLinksValues;
  label: string;
  iconSrc: string;
  placeholder: string;
}[] = [
  {
    key: "website",
    label: "Website",
    iconSrc: "/icons/civic/website.svg",
    placeholder: "https://example.com",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    iconSrc: "/icons/civic/icons8-linkedin.svg",
    placeholder: "https://www.linkedin.com/in/your-profile",
  },
  {
    key: "facebookUrl",
    label: "Facebook",
    iconSrc: "/icons/civic/icons8-facebook.svg",
    placeholder: "https://www.facebook.com/your-profile",
  },
  {
    key: "youtubeUrl",
    label: "YouTube",
    iconSrc: "/icons/civic/icons8-youtube.svg",
    placeholder: "https://www.youtube.com/@your-channel",
  },
  {
    key: "instagramUrl",
    label: "Instagram",
    iconSrc: "/icons/civic/icons8-instagram.svg",
    placeholder: "https://www.instagram.com/your-profile",
  },
  {
    key: "xUrl",
    label: "X",
    iconSrc: "/icons/civic/icons8-x.svg",
    placeholder: "https://x.com/your-handle",
  },
];

interface MemberProfessionalLinksSectionProps extends MemberProfessionalLinksValues {
  disabled?: boolean;
  /** Profile UX Pack 02 Part 3 — drives the reusable Save-button feedback. */
  phase?: SaveButtonPhase;
  onChange: (patch: Partial<MemberProfessionalLinksValues>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function MemberProfessionalLinksSection({
  website,
  linkedinUrl,
  facebookUrl,
  youtubeUrl,
  instagramUrl,
  xUrl,
  disabled = false,
  phase = "idle",
  onChange,
  onSubmit,
}: MemberProfessionalLinksSectionProps) {
  const busy = phase !== "idle";
  const values: MemberProfessionalLinksValues = {
    website,
    linkedinUrl,
    facebookUrl,
    youtubeUrl,
    instagramUrl,
    xUrl,
  };

  return (
    <form className="member-professional-links" onSubmit={onSubmit}>
      <p className="hu-caption member-professional-links__lede">
        Personal links on your Participant profile. These are not Humanity Union publication
        distribution destinations.
      </p>
      {PROFESSIONAL_LINK_FIELDS.map((field) => (
        <label
          key={field.key}
          className="member-professional-links__field member-professional-links__field--with-icon"
        >
          <span>{field.label}</span>
          <span className="member-professional-links__input-row">
            <img
              className="member-professional-links__field-icon"
              src={field.iconSrc}
              alt=""
              aria-hidden="true"
              width={30}
              height={30}
            />
            <input
              className="hu-form-control"
              value={values[field.key] ?? ""}
              disabled={disabled || busy}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
              placeholder={field.placeholder}
              autoComplete="off"
              inputMode="url"
            />
          </span>
        </label>
      ))}

      <Button type="submit" variant="primary" disabled={disabled || busy} ariaLive="polite">
        {resolveSaveButtonLabel(phase, "Save professional links")}
      </Button>
    </form>
  );
}

interface MemberProfessionalLinksDisplayProps extends MemberProfessionalLinksValues {
  className?: string;
}

export function hasConfiguredProfessionalLinks(
  values: MemberProfessionalLinksValues,
): boolean {
  return PROFESSIONAL_LINK_FIELDS.some((field) => Boolean(values[field.key]?.trim()));
}

export function MemberProfessionalLinksDisplay({
  website,
  linkedinUrl,
  facebookUrl,
  youtubeUrl,
  instagramUrl,
  xUrl,
  className,
}: MemberProfessionalLinksDisplayProps) {
  const values: MemberProfessionalLinksValues = {
    website,
    linkedinUrl,
    facebookUrl,
    youtubeUrl,
    instagramUrl,
    xUrl,
  };

  if (!hasConfiguredProfessionalLinks(values)) {
    return null;
  }

  return (
    <div className={["member-professional-links__display", className].filter(Boolean).join(" ")}>
      {PROFESSIONAL_LINK_FIELDS.map((field) => {
        const href = values[field.key]?.trim();
        if (!href) {
          return null;
        }
        return (
          <a
            key={field.key}
            className="member-professional-links__external-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={field.label}
          >
            <img src={field.iconSrc} alt="" aria-hidden="true" width={30} height={30} />
            <span>{field.label}</span>
          </a>
        );
      })}
    </div>
  );
}

interface MemberSkillTagsProps {
  skills: string[];
  className?: string;
}

export function MemberSkillTags({ skills, className }: MemberSkillTagsProps) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <ul
      className={["member-skills-editor__tags", className].filter(Boolean).join(" ")}
      aria-label="Skills"
    >
      {skills.map((skill) => (
        <li key={skill} className="member-skills-editor__tag">
          <span>{skill}</span>
        </li>
      ))}
    </ul>
  );
}
