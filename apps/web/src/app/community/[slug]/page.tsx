import { notFound } from "next/navigation";

import {
  CommunityExperiencePage,
  loadCommunityExperiencePageData,
} from "../../../features/community-experience/components/CommunityExperiencePage";
import { BOOTSTRAP_COMMUNITY_SLUGS } from "../../../features/community-experience/projections/bootstrap-communities";

import "../../../features/global-experience/global-experience.css";
import "../../../features/community-experience/community-experience.css";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BOOTSTRAP_COMMUNITY_SLUGS.map((slug) => ({ slug }));
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { slug } = await params;
  const { projections, catalog } = await loadCommunityExperiencePageData(slug);

  if (!projections) {
    notFound();
  }

  return <CommunityExperiencePage slug={slug} projections={projections} catalog={catalog} />;
}
