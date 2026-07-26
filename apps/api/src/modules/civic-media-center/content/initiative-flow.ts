import type { CivicMediaInitiativeFlow } from "@hu/types";

const INITIATIVE_FLOW_DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 120" role="img" aria-label="News to civic archive flow">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#1a1a1a"/>
    </marker>
  </defs>
  <g font-family="system-ui, sans-serif" font-size="11" fill="#1a1a1a">
    <rect x="4" y="40" width="64" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="36" y="64" text-anchor="middle">News</text>
    <line x1="68" y1="60" x2="88" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="88" y="40" width="72" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="124" y="64" text-anchor="middle">Verify</text>
    <line x1="160" y1="60" x2="180" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="180" y="40" width="80" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="220" y="64" text-anchor="middle">Discuss</text>
    <line x1="260" y1="60" x2="280" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="280" y="40" width="72" height="40" rx="6" fill="#eef4ff" stroke="#446"/>
    <text x="316" y="64" text-anchor="middle">Initiative</text>
    <line x1="352" y1="60" x2="372" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="372" y="40" width="64" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="404" y="64" text-anchor="middle">Analysis</text>
    <line x1="436" y1="60" x2="456" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="456" y="40" width="64" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="488" y="64" text-anchor="middle">Proposal</text>
    <line x1="520" y1="60" x2="540" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="540" y="40" width="64" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="572" y="64" text-anchor="middle">Decision</text>
    <line x1="604" y1="60" x2="624" y2="60" stroke="#1a1a1a" marker-end="url(#arrow)"/>
    <rect x="624" y="40" width="72" height="40" rx="6" fill="#f5f5f5" stroke="#ccc"/>
    <text x="660" y="64" text-anchor="middle">Impact</text>
  </g>
</svg>`;

export const CIVIC_MEDIA_INITIATIVE_FLOW: CivicMediaInitiativeFlow = {
  title: "How news creates initiatives",
  summary:
    "Verified information can enter the civic pipeline as constructive participation — not as reactive outrage.",
  diagramSvg: INITIATIVE_FLOW_DIAGRAM,
  stages: [
    "News",
    "Verification",
    "Discussion",
    "Initiative",
    "Analysis",
    "Proposal",
    "Decision",
    "Implementation",
    "Impact",
    "Archive",
  ],
};
