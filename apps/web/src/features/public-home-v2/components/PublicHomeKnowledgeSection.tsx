import Link from "next/link";

import { Card } from "../../../design-system";
import {
  HOME_KNOWLEDGE_COLLECTION_MAX,
  PUBLIC_HOME_KNOWLEDGE_ENTRIES,
  PUBLIC_HOME_KNOWLEDGE_MUTED_TONES,
} from "../constants";

import { PublicHomeKnowledgeCollection } from "./PublicHomeKnowledgeCollection";

export function PublicHomeKnowledgeSection() {
  const entries = PUBLIC_HOME_KNOWLEDGE_ENTRIES.slice(0, HOME_KNOWLEDGE_COLLECTION_MAX);

  return (
    <PublicHomeKnowledgeCollection
      items={entries.map((entry, index) => ({
        ...entry,
        tone:
          PUBLIC_HOME_KNOWLEDGE_MUTED_TONES[index % PUBLIC_HOME_KNOWLEDGE_MUTED_TONES.length] ??
          "pale-blue",
      }))}
      headerAction={<Link href="/knowledge">Explore Knowledge</Link>}
    />
  );
}

export function PublicHomeKnowledgeCard({
  title,
  description,
  actionLabel,
  href,
  tone,
}: {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: string;
}) {
  return (
    <Card className={`public-home-v2__knowledge-card public-home-v2__knowledge-card--${tone}`}>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link href={href} className="public-home-v2__knowledge-card-action">
        {actionLabel}
      </Link>
    </Card>
  );
}
