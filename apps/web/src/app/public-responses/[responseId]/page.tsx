import Link from "next/link";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicOfficialResponse } from "../../../features/official-response/api";
import { listPublicCivicAccountabilitiesForResponse } from "../../../features/civic-accountability/api";
import { CivicAccountabilityPublicSection } from "../../../features/civic-accountability/components/CivicAccountabilityPublicSection";

interface PublicOfficialResponsePageProps {
  params: Promise<{
    responseId: string;
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

function formatType(responseType: string): string {
  return responseType.replace(/_/g, " ");
}

export default async function PublicOfficialResponsePage({
  params,
}: PublicOfficialResponsePageProps) {
  const { responseId } = await params;
  const response = await getPublicOfficialResponse(responseId);
  const civicAccountability = response
    ? await listPublicCivicAccountabilitiesForResponse(responseId)
    : [];

  if (!response) {
    return (
      <main>
        <h1>Official response not available</h1>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>{response.responseNumber}</h1>
        <p>Official institutional response · {response.organizationName}</p>
      </header>

      <ProfileSection title="Official Response">
        <ProfileField label="Response number" value={response.responseNumber} />
        <ProfileField label="Organization" value={response.organizationName} />
        <ProfileField label="Response type" value={formatType(response.responseType)} />
        <ProfileField label="Received" value={formatDate(response.receivedAt)} />
        <ProfileField label="Published" value={formatDate(response.publishedAt)} />
        <ProfileField
          label="Verification state"
          value={response.verificationState.replace(/_/g, " ")}
        />
        <ProfileField label="Publication status" value={response.publicationStatus} />
        <ProfileField label="Subject" value={response.subject} />
        <ProfileField label="Summary" value={response.summary} />
        <ProfileField label="Reference" value={response.responseReference} />
      </ProfileSection>

      <ProfileSection title="Related Civic Records">
        <ul>
          <li>
            <Link href={response.references.capUrl}>Civic Action Package</Link>
          </li>
          <li>
            <Link href={response.references.initiativeUrl}>Public Initiative</Link>
          </li>
          <li>
            <Link href={response.references.decisionUrl}>Collective Decision</Link>
          </li>
          {response.references.deliveryUrl ? (
            <li>
              <Link href={response.references.deliveryUrl}>Civic Delivery Log</Link>
            </li>
          ) : null}
        </ul>
      </ProfileSection>

      {civicAccountability.length > 0 ? (
        <ProfileSection title="Civic Accountability">
          <CivicAccountabilityPublicSection records={civicAccountability} />
        </ProfileSection>
      ) : null}

      <CivicIntegrationPanel entityType="official-response" entityId={responseId} />

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
