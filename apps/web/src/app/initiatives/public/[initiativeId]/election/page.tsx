import { PublicChoiceElectionPage } from "../../../../../features/public-initiative-experience/components/PublicChoiceElectionPage";

export const dynamic = "force-dynamic";

interface PublicChoiceElectionRouteProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

/**
 * Pack 02A — Election detail/results derived from the Initiative.
 * Route: /initiatives/public/:initiativeId/election
 */
export default async function PublicChoiceElectionRoute({
  params,
}: PublicChoiceElectionRouteProps) {
  const { initiativeId } = await params;
  return <PublicChoiceElectionPage initiativeId={initiativeId} />;
}
