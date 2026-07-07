import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicCivicActionPackage } from "../../../../features/civic-action-package/api";
import {
  getPublicCivicDelivery,
  listPublicCivicDeliveriesForCap,
} from "../../../../features/civic-delivery/api";
import { listPublicOfficialResponsesForCap } from "../../../../features/official-response/api";
import { listPublicCivicAccountabilitiesForCap } from "../../../../features/civic-accountability/api";
import { OfficialResponsesPublicSection } from "../../../../features/official-response/components/OfficialResponsesPublicSection";
import { CivicAccountabilityPublicSection } from "../../../../features/civic-accountability/components/CivicAccountabilityPublicSection";

interface PublicCivicActionPackagePageProps {
  params: Promise<{
    capId: string;
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

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, " ");
}

export default async function PublicCivicActionPackagePage({
  params,
}: PublicCivicActionPackagePageProps) {
  const { capId } = await params;
  const capPackage = await getPublicCivicActionPackage(capId);
  const deliveryLog = capPackage ? await listPublicCivicDeliveriesForCap(capId) : [];
  const officialResponses = capPackage ? await listPublicOfficialResponsesForCap(capId) : [];
  const civicAccountability = capPackage ? await listPublicCivicAccountabilitiesForCap(capId) : [];
  const deliveryDetails = await Promise.all(
    deliveryLog.map((entry) => getPublicCivicDelivery(entry.deliveryId)),
  );
  const publicDeliveries = deliveryDetails.filter(
    (delivery): delivery is NonNullable<typeof delivery> => delivery !== null,
  );

  if (!capPackage) {
    return (
      <main>
        <h1>Civic Action Package not available</h1>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>{capPackage.title}</h1>
        <p>Official Civic Action Package · CAP #{capPackage.capNumber}</p>
      </header>

      <ProfileSection title="Civic Action Package">
        <ProfileField label="CAP ID" value={capPackage.capId} />
        <ProfileField label="CAP number" value={String(capPackage.capNumber)} />
        <ProfileField label="Version" value={String(capPackage.capVersion)} />
        <ProfileField label="Status" value={capPackage.status} />
        <ProfileField label="Issued" value={formatDate(capPackage.issuedAt)} />
        <ProfileField label="Participation scope" value={capPackage.participationScope} />
        <ProfileField label="Summary" value={capPackage.summary} />
      </ProfileSection>

      <ProfileSection title="Decision Result">
        <ProfileField label="Initiative" value={capPackage.initiativeTitle} />
        <ProfileField label="Initiative version" value={String(capPackage.initiativeVersion)} />
        <ProfileField label="Decision question" value={capPackage.decisionQuestion} />
        <ProfileField label="Outcome" value={formatOutcome(capPackage.decisionOutcome)} />
        <ProfileField label="Result summary" value={capPackage.decisionResultSummary} />
      </ProfileSection>

      <ProfileSection title="Vote Totals">
        <ProfileField label="Support" value={String(capPackage.support)} />
        <ProfileField label="Do not support" value={String(capPackage.doNotSupport)} />
        <ProfileField label="Abstain" value={String(capPackage.abstain)} />
      </ProfileSection>

      <ProfileSection title="Verified / Unverified Breakdown">
        <ProfileField
          label="Verified support / do not support / abstain"
          value={`${capPackage.verifiedStatistics.support} / ${capPackage.verifiedStatistics.doNotSupport} / ${capPackage.verifiedStatistics.abstain}`}
        />
        <ProfileField
          label="Unverified support / do not support / abstain"
          value={`${capPackage.unverifiedStatistics.support} / ${capPackage.unverifiedStatistics.doNotSupport} / ${capPackage.unverifiedStatistics.abstain}`}
        />
        <p>{capPackage.transparencyNote}</p>
      </ProfileSection>

      <ProfileSection title="Civic Process Summary">
        <ProfileField label="Analyses" value={String(capPackage.collaborativeAnalysesCount)} />
        <ProfileField label="Proposals" value={String(capPackage.improvementProposalsCount)} />
        <ProfileField label="Revisions" value={String(capPackage.revisionCount)} />
        <ProfileField label="Process" value={capPackage.civicProcessSummary} />
        {capPackage.civicCompatibilityReviewId ? (
          <ProfileField
            label="Civic compatibility review"
            value={capPackage.civicCompatibilityReviewStatus ?? "Available"}
          />
        ) : null}
      </ProfileSection>

      <ProfileSection title="References">
        <ul>
          <li>
            <Link href={capPackage.references.initiativeUrl}>Public Initiative</Link>
          </li>
          <li>
            <Link href={capPackage.references.decisionUrl}>Collective Decision</Link>
          </li>
          <li>
            <Link href={capPackage.references.decisionSessionUrl}>Decision Session</Link>
          </li>
          {capPackage.references.civicCompatibilityReviewUrl ? (
            <li>
              <Link href={capPackage.references.civicCompatibilityReviewUrl}>
                Civic Compatibility Review
              </Link>
            </li>
          ) : null}
        </ul>
      </ProfileSection>

      {publicDeliveries.length > 0 ? (
        <ProfileSection title="Public Delivery Log">
          {publicDeliveries.map((delivery) => (
            <div key={delivery.deliveryId}>
              <ProfileField
                label="Delivery"
                value={`${delivery.status} · ${delivery.deliveryMode ?? "unknown"} · ${formatDate(delivery.sentAt)}`}
              />
              <ul>
                {delivery.recipients.map((recipient) => (
                  <li key={`${delivery.deliveryId}-${recipient.name}-${recipient.recipientType}`}>
                    <strong>{recipient.name}</strong>
                    {recipient.organization ? ` · ${recipient.organization}` : ""} ·{" "}
                    {recipient.recipientType.replace(/_/g, " ")} · {recipient.deliveryStatus}
                    {recipient.sentAt ? ` · ${formatDate(recipient.sentAt)}` : ""}
                    <p>{recipient.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </ProfileSection>
      ) : null}

      {officialResponses.length > 0 ? (
        <ProfileSection title="Official Responses">
          <OfficialResponsesPublicSection responses={officialResponses} />
        </ProfileSection>
      ) : null}

      {civicAccountability.length > 0 ? (
        <ProfileSection title="Civic Accountability">
          <CivicAccountabilityPublicSection records={civicAccountability} />
        </ProfileSection>
      ) : null}

      <CivicIntegrationPanel entityType="civic-action-package" entityId={capId} />

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
