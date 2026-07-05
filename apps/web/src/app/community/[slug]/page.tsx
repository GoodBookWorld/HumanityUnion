import { notFound } from "next/navigation";

import { CommunityExperiencePage } from "../../../features/community-experience/components/CommunityExperiencePage";
import {
  getKnownCommunitySlugs,
  loadCommunityExperiencePageData,
} from "../../../features/public-projection-engine";

import "../../../features/public-experience/public-experience.css";
import "../../../features/community-experience/community-experience.css";

interface CommunityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getKnownCommunitySlugs();
  return slugs.map((slug) => ({ slug }));
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
