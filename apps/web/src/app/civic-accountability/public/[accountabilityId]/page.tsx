import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicCivicAccountability } from "../../../../features/civic-accountability/api";

interface PublicCivicAccountabilityPageProps {
  params: Promise<{
    accountabilityId: string;
  }>;
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatType(value: string): string {
  return value.replace(/_/g, " ");
}

export default async function PublicCivicAccountabilityPage({
  params,
}: PublicCivicAccountabilityPageProps) {
  const { accountabilityId } = await params;
  const accountability = await getPublicCivicAccountability(accountabilityId);

  if (!accountability) {
    return (
      <main>
        <h1>Civic accountability not available</h1>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Civic Accountability</h1>
        <p>Public follow-up timeline after civic delivery and official responses</p>
      </header>

      <ProfileSection title="Accountability">
        <ProfileField label="Status" value={accountability.status} />
        <ProfileField label="CAP" value={accountability.capId} />
        <ProfileField label="Created" value={formatDate(accountability.createdAt)} />
        <ProfileField label="Updated" value={formatDate(accountability.updatedAt)} />
        {accountability.recipient ? (
          <ProfileField
            label="Recipient"
            value={`${accountability.recipient.name}${accountability.recipient.organization ? ` · ${accountability.recipient.organization}` : ""} · ${formatType(accountability.recipient.recipientType)}`}
          />
        ) : null}
        {accountability.officialResponseNumber ? (
          <ProfileField
            label="Official response"
            value={`${accountability.officialResponseNumber}${accountability.officialResponseOrganization ? ` — ${accountability.officialResponseOrganization}` : ""}`}
          />
        ) : null}
      </ProfileSection>

      <ProfileSection title="Timeline">
        {accountability.events.length === 0 ? (
          <p>No accountability events recorded yet.</p>
        ) : (
          <ul>
            {accountability.events.map((event) => (
              <li key={event.eventId}>
                <h2>{event.title}</h2>
                <p>
                  {formatType(event.eventType)} · {formatDate(event.occurredAt)}
                </p>
                <p>{event.summary}</p>
                {event.evidenceReference ? (
                  <ProfileField label="Evidence reference" value={event.evidenceReference} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title="Related Civic Records">
        <ul>
          <li>
            <Link href={accountability.references.capUrl}>Civic Action Package</Link>
          </li>
          <li>
            <Link href={accountability.references.initiativeUrl}>Public Initiative</Link>
          </li>
          <li>
            <Link href={accountability.references.decisionUrl}>Collective Decision</Link>
          </li>
          {accountability.references.deliveryUrl ? (
            <li>
              <Link href={accountability.references.deliveryUrl}>Civic Delivery Log</Link>
            </li>
          ) : null}
          {accountability.references.responseUrl ? (
            <li>
              <Link href={accountability.references.responseUrl}>Official Response</Link>
            </li>
          ) : null}
        </ul>
      </ProfileSection>

      <CivicIntegrationPanel entityType="civic-accountability" entityId={accountabilityId} />

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
