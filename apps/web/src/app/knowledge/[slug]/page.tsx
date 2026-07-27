import { KnowledgeArticlePageContent } from "../../../features/knowledge-center/components/KnowledgeArticlePageContent";

interface KnowledgeArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function KnowledgeArticlePage({ params }: KnowledgeArticlePageProps) {
  const { slug } = await params;

  return <KnowledgeArticlePageContent slug={slug} />;
}
