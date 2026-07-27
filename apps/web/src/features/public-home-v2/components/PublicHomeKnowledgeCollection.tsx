"use client";

import type { ReactNode } from "react";

import Link from "next/link";

import { HuxEducationSection } from "../../horizontal-experience";
import { PublicHomeKnowledgeCard } from "./PublicHomeKnowledgeSection";

interface PublicHomeKnowledgeCollectionItem {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: string;
}

export function PublicHomeKnowledgeCollection({
  items,
  headerAction,
}: {
  items: readonly PublicHomeKnowledgeCollectionItem[];
  headerAction?: ReactNode;
}) {
  return (
    <HuxEducationSection
      sectionId="public-home-knowledge"
      eyebrow="LEARN AND PARTICIPATE"
      title="Knowledge"
      description="Learn how civic processes work before you participate."
      label="knowledge resources"
      items={[...items]}
      layout="four-three-one"
      headerAction={headerAction ?? <Link href="/knowledge">Explore Knowledge</Link>}
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <PublicHomeKnowledgeCard
          title={item.title}
          description={item.description}
          actionLabel={item.actionLabel}
          href={item.href}
          tone={item.tone}
        />
      )}
    />
  );
}
