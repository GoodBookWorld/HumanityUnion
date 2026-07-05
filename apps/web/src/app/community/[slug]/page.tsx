import { notFound } from "next/navigation";

import { CommunityExperiencePage } from "../../../features/community-experience/components/CommunityExperiencePage";
import {
  BOOTSTRAP_COMMUNITY_SLUGS,
  loadCommunityExperiencePageData,
} from "../../../features/public-projection-engine";

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
  const pageData = await loadCommunityExperiencePageData(slug);

  if (!pageData) {
    notFound();
  }

  return (
    <CommunityExperiencePage
      slug={slug}
      projections={pageData.projections}
      catalog={pageData.catalog}
    />
  );
}
