import { ProfileSection } from "../../../components/member/ProfileSection";

interface AdminCapabilityGapProps {
  title: string;
  message: string;
  details?: readonly string[];
}

/** Concise "Not collected yet" state — never invents metrics. */
export function AdminCapabilityGap({ title, message, details }: AdminCapabilityGapProps) {
  return (
    <ProfileSection title={title}>
      <p className="hu-body admin-panel__capability-gap" role="status">
        <strong>Not collected yet.</strong> {message}
      </p>
      {details && details.length > 0 ? (
        <ul className="admin-panel__gap-list hu-caption">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </ProfileSection>
  );
}
