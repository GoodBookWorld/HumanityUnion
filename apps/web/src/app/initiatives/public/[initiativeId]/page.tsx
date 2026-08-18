import { CanonicalInitiativeExperienceLoader } from "../../../../features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader";

export const dynamic = "force-dynamic";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

/**
 * Canonical Initiative experience. Client-loads with credentials so
 * viewerIsSteward / Manage / Author Mode match the authenticated session
 * for both Workspace and Header entry paths.
 */
export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;

  return <CanonicalInitiativeExperienceLoader initiativeId={initiativeId} />;
}
