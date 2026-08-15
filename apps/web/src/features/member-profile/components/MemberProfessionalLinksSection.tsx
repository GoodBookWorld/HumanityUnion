"use client";

import { Button } from "../../../design-system/components/Button";
import { resolveSaveButtonLabel, type SaveButtonPhase } from "../use-save-button-phase";

import "./member-professional-links.css";

interface MemberProfessionalLinksSectionProps {
  website?: string;
  linkedinUrl?: string;
  disabled?: boolean;
  /** Profile UX Pack 02 Part 3 — drives the reusable Save-button feedback. */
  phase?: SaveButtonPhase;
  onWebsiteChange: (website: string) => void;
  onLinkedInChange: (linkedinUrl: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function MemberProfessionalLinksSection({
  website,
  linkedinUrl,
  disabled = false,
  phase = "idle",
  onWebsiteChange,
  onLinkedInChange,
  onSubmit,
}: MemberProfessionalLinksSectionProps) {
  const busy = phase !== "idle";
  return (
    <form className="member-professional-links" onSubmit={onSubmit}>
      <label className="member-professional-links__field member-professional-links__field--with-icon">
        <span>Website</span>
        <span className="member-professional-links__input-row">
          <img
            className="member-professional-links__field-icon"
            src="/icons/civic/website.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={30}
          />
          <input
            className="hu-form-control"
            value={website ?? ""}
            disabled={disabled || busy}
            onChange={(event) => onWebsiteChange(event.target.value)}
            placeholder="https://example.com"
          />
        </span>
      </label>
      <label className="member-professional-links__field member-professional-links__field--with-icon">
        <span>LinkedIn</span>
        <span className="member-professional-links__input-row">
          <img
            className="member-professional-links__field-icon"
            src="/icons/civic/icons8-linkedin.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={30}
          />
          <input
            className="hu-form-control"
            value={linkedinUrl ?? ""}
            disabled={disabled || busy}
            onChange={(event) => onLinkedInChange(event.target.value)}
            placeholder="https://www.linkedin.com/in/your-profile"
          />
        </span>
      </label>

      <Button type="submit" variant="primary" disabled={disabled || busy} ariaLive="polite">
        {resolveSaveButtonLabel(phase, "Save professional links")}
      </Button>
    </form>
  );
}

interface MemberProfessionalLinksDisplayProps {
  website?: string;
  linkedinUrl?: string;
  className?: string;
}

export function MemberProfessionalLinksDisplay({
  website,
  linkedinUrl,
  className,
}: MemberProfessionalLinksDisplayProps) {
  if (!website && !linkedinUrl) {
    return null;
  }

  return (
    <div className={["member-professional-links__display", className].filter(Boolean).join(" ")}>
      {website ? (
        <a
          className="member-professional-links__external-link"
          href={website}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/icons/civic/website.svg" alt="" aria-hidden="true" width={30} height={30} />
          <span>Website</span>
        </a>
      ) : null}
      {linkedinUrl ? (
        <a
          className="member-professional-links__external-link"
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/icons/civic/icons8-linkedin.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={30}
          />
          <span>LinkedIn</span>
        </a>
      ) : null}
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
