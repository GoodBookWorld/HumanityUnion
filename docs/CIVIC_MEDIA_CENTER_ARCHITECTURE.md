# Civic Media Center Architecture

## Purpose

The Civic Media Center is a standalone Civic Media workspace at `/media`.

It is **not** a news portal, media company, or social feed. Its purpose is to:

- Help people navigate trustworthy information
- Explain why information quality matters
- Provide curated media, fact-checking, and propaganda analysis resources
- Show how verified news can inspire constructive civic initiatives

Humanity Union does not publish independent journalism. Media literacy is civic responsibility.

## Structure

```
Knowledge Center
└── Civic Media Center (/media)
    ├── Overview
    ├── Trusted Media
    ├── Fact-Checking Resources
    ├── Propaganda Analysis
    ├── News Widgets (reference architecture)
    ├── How News Creates Initiatives
    ├── Why We Recommend These Sources
    └── FAQ
```

## Module layout

| Layer         | Path                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| Types         | `packages/types/src/domain/civic-media-center.ts`                                     |
| API module    | `apps/api/src/modules/civic-media-center/`                                            |
| Public routes | `GET /api/v1/public/knowledge/media`, `GET /api/v1/public/knowledge/media/categories` |
| Frontend      | `apps/web/src/features/civic-media-center/`                                           |
| Page route    | `apps/web/src/app/media/page.tsx` (legacy `/knowledge/media` redirects here)       |

Static content lives in `apps/api/src/modules/civic-media-center/content/`. No CMS, no CRUD.

## Selection principles

Resources are curated using documented criteria — not popularity, scores, stars, or votes:

- Editorial transparency
- Correction policy
- Professional standards
- Evidence-based reporting
- International recognition
- Fact-checking practice

## Knowledge integration

- Listed in the Knowledge sidebar under **Subsections → Civic Media Center**
- Mounted under the Knowledge Center API router at `/media`
- Shares Knowledge Center layout (sticky sidebar, Humanity Design System cards)

## Global Search

Media resources index as `knowledge_media` entity type.

```
GET /api/v1/public/search?entityType=knowledge_media&q=...
```

Indexed entries include the Civic Media Center hub, trusted media sources, fact-check organizations, and propaganda analysis resources.

## Assistant integration

Workspace Civic Assistant attaches `civicMediaReferences` when prompts mention verification, source evaluation, disinformation, or creating initiatives from news.

References link to `/media#<section>` anchors.

## News widget architecture

News widgets are **static reference examples**, not a live feed or RSS engine.

Each widget includes:

- Source
- Headline
- Publication date
- Short excerpt
- Read Original → (external link)
- Create Initiative → (links to `/initiatives` with reference query params)

### Deferred integration

Initiative draft creation does not yet read `mediaHeadline`, `mediaSource`, or `mediaUrl` query parameters. The href contract is prepared for a future workspace prefill step.

## Explicit exclusions

Not implemented:

- News publishing
- Blog
- Comments
- Ratings or popularity
- Recommendation engines
- RSS aggregation
- AI article summaries
- Media reputation scoring
- Advertising

## Future CMS

Content files use typed static records (`TrustedMediaResource`, `FactCheckResource`, etc.) so a future CMS can replace file-based authoring without changing public API contracts.

## Verification

```bash
npm run verify:media-center
```

Also run existing gates: `verify:knowledge`, `verify:global-search`, `verify:workspace-assistant-engine`, `verify:workspace-intelligence`, `verify:design-system`.
