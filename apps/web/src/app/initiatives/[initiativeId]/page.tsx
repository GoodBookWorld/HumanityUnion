import { InitiativeExperiencePage } from "../../../features/initiative-owner-studio/components/InitiativeExperiencePage";

export const dynamic = "force-dynamic";

interface InitiativeExperienceRouteProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

export default async function InitiativeExperienceRoute({
  params,
}: InitiativeExperienceRouteProps) {
  const { initiativeId } = await params;

  return <InitiativeExperiencePage initiativeId={initiativeId} />;
}
