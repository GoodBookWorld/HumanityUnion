import type { Member } from "@hu/types";

import { ApiUnavailableState } from "../../design-system";
import { getCurrentMember } from "../../features/member/member-api";

function formatLocation(member: Member): string {
  const { city, region, country } = member.profile;
  const parts = [city, region, country].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

export default async function MemberPage() {
  let member: Member | null = null;

  try {
    member = await getCurrentMember();
  } catch {
    member = null;
  }

  if (!member) {
    return (
      <main className="humanity-workspace-page">
        <ApiUnavailableState
          title="Member profile is temporarily unavailable"
          explanation="We could not load your member profile right now. Your account information is safe, but this page cannot be shown until the connection is restored."
          possibleReason="The member service may be starting up, undergoing maintenance, or temporarily unreachable."
          retryHref="/member"
        />
      </main>
    );
  }

  return (
    <main className="humanity-workspace-page">
      <h1>Member Profile</h1>

      <section>
        <h2>Identity</h2>
        <p>
          <strong>Display Name:</strong> {member.profile.displayName}
        </p>
        <p>
          <strong>Unique Name:</strong> {member.profile.uniqueName}
        </p>
        <p>
          <strong>Location:</strong> {formatLocation(member)}
        </p>
        <p>
          <strong>Verification Level:</strong> {member.verificationLevel}
        </p>
        <p>
          <strong>Roles:</strong> {member.roles.join(", ")}
        </p>
      </section>

      <section>
        <h2>Fair Summary</h2>
        <p>
          <strong>Personal:</strong> {member.fair.personal}
        </p>
        <p>
          <strong>Community:</strong> {member.fair.community}
        </p>
        <p>
          <strong>Regional:</strong> {member.fair.regional}
        </p>
        <p>
          <strong>Global:</strong> {member.fair.global}
        </p>
      </section>

      <section>
        <h2>Impact Profile Summary</h2>
        {member.impactProfile ? (
          <>
            <p>
              <strong>Scope:</strong> {member.impactProfile.scope}
            </p>
            <p>
              <strong>Priority Categories:</strong>{" "}
              {member.impactProfile.priorityCategories.join(", ")}
            </p>
            <p>
              <strong>Preferred Tools:</strong> {member.impactProfile.preferredTools.join(", ")}
            </p>
            <p>
              <strong>Time Commitment:</strong>{" "}
              {member.impactProfile.timeCommitment ?? "Not specified"}
            </p>
          </>
        ) : (
          <p>Not specified</p>
        )}
      </section>
    </main>
  );
}
