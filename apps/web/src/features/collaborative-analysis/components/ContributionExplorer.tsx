"use client";

import type { Contribution, ContributionType } from "@hu/types";
import { useMemo, useState } from "react";

import "./contribution-explorer.css";

interface ContributionExplorerProps {
  contributions: Contribution[];
}

const CONTRIBUTION_GROUPS: { type: ContributionType; label: string }[] = [
  { type: "Evidence", label: "Evidence" },
  { type: "Question", label: "Question" },
  { type: "Alternative", label: "Alternative" },
  { type: "Clarification", label: "Clarification" },
  { type: "Reference", label: "Reference" },
  { type: "ExpertOpinion", label: "Expert Opinion" },
  { type: "SummaryProposal", label: "Summary Proposal" },
  { type: "Correction", label: "Correction" },
];

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ContributionExplorer({ contributions }: ContributionExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ContributionType | "all">("all");

  const filteredContributions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return contributions.filter((contribution) => {
      if (selectedType !== "all" && contribution.contributionType !== selectedType) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        contribution.title.toLowerCase().includes(normalizedQuery) ||
        contribution.content.toLowerCase().includes(normalizedQuery) ||
        contribution.authorId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [contributions, searchQuery, selectedType]);

  const groupedContributions = useMemo(() => {
    return CONTRIBUTION_GROUPS.map((group) => ({
      ...group,
      items: filteredContributions.filter(
        (contribution) => contribution.contributionType === group.type,
      ),
    })).filter((group) => group.items.length > 0);
  }, [filteredContributions]);

  return (
    <div className="contribution-explorer">
      <div className="contribution-explorer__controls">
        <label className="contribution-explorer__search-label">
          Search
          <input
            type="search"
            className="contribution-explorer__search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search contributions"
          />
        </label>

        <label className="contribution-explorer__filter-label">
          Filter by type
          <select
            className="contribution-explorer__filter"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(event.target.value as ContributionType | "all")
            }
          >
            <option value="all">All types</option>
            {CONTRIBUTION_GROUPS.map((group) => (
              <option key={group.type} value={group.type}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groupedContributions.length === 0 ? (
        <p className="contribution-explorer__empty">No contributions match the current filters.</p>
      ) : (
        <div className="contribution-explorer__groups">
          {groupedContributions.map((group) => (
            <section key={group.type} className="contribution-explorer__group">
              <h3 className="contribution-explorer__group-title">{group.label}</h3>
              <ul className="contribution-explorer__list">
                {group.items.map((contribution) => (
                  <li key={contribution.contributionId} className="contribution-explorer__item">
                    <p className="contribution-explorer__item-title">{contribution.title}</p>
                    <p className="contribution-explorer__item-content">{contribution.content}</p>
                    <p className="contribution-explorer__item-meta">
                      <span>Author: {contribution.authorId}</span>
                      <span>Created: {formatCreatedDate(contribution.createdAt)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
