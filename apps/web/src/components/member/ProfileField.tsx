import "./profile-field.css";

interface ProfileFieldProps {
  label: string;
  value: string;
  /** Language of `value` when it differs from the page (e.g. authored or translated content). */
  lang?: string;
  /** `auto` for authored content, `ltr` for URLs and identifiers. */
  dir?: "auto" | "ltr" | "rtl";
}

export function ProfileField({ label, value, lang, dir }: ProfileFieldProps) {
  return (
    <div className="profile-field">
      <span className="profile-field__label">{label}</span>
      <span className="profile-field__value" lang={lang} dir={dir}>
        {value || "Not specified"}
      </span>
    </div>
  );
}
