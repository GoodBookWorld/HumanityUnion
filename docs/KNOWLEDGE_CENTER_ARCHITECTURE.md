# Knowledge Center Architecture

Humanity Union Knowledge Center (TASK-065) is the official educational and reference library for the platform.

## Purpose

Knowledge Center explains:

- Humanity Union philosophy
- Civic processes and Capability 02 pipeline
- Platform concepts and terminology
- Institution interaction (educational only)
- Constitutional and governance principles

Knowledge **explains**. It never persuades. Articles are politically neutral, versioned, and static.

## Structure

Public route: `/knowledge`

| Category                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| Getting Started         | Platform introduction                        |
| Explanations            | Concise concept articles (2–5 min reads)     |
| Institutions Experience | Educational institution interaction overview |
| Guides                  | Step-by-step tutorials                       |
| Constitution            | Governance and transparency principles       |
| Glossary                | Alphabetical terminology                     |
| FAQ                     | Short answers                                |

Article route: `/knowledge/[slug]`

## Article standard

Every article includes:

- Header (title + purpose question)
- Purpose
- Diagram (inline SVG)
- Overview + explanation sections
- Key concepts
- Related concepts, guides, workspace section, public pages
- Last updated + version
- Estimated reading time

Content lives in static TypeScript files under `apps/api/src/modules/knowledge-center/content/`. No CMS in v1.

## Public APIs

```
GET /api/v1/public/knowledge
GET /api/v1/public/knowledge/categories
GET /api/v1/public/knowledge/:slug
GET /api/v1/public/knowledge/diagrams/:diagramId
```

All routes are public — no authentication required.

## Search integration

Knowledge articles index into Global Search as `knowledge_article` entity type.

```
GET /api/v1/public/search?entityType=knowledge_article&q=...
```

Knowledge Center search UI uses this filter. Civic record search remains separate.

## Assistant integration

Workspace Civic Assistant attaches `knowledgeReferences` to responses instead of inventing long explanations.

Mapping:

- Assistant capabilities → related article slugs
- Current workspace section → contextual articles
- User prompt terms → search matches

Mock and AI-assisted providers both receive knowledge references via the safety guard layer.

## Future CMS path

v1 uses static TS content with a stable article record shape (`KnowledgeArticleRecord`). Future CMS can:

1. Replace `ALL_KNOWLEDGE_ARTICLES` with database-backed store
2. Keep projection and API contracts unchanged
3. Add editorial workflow without changing public routes

## Verification

```bash
npm run verify:knowledge
```

Also run: `verify:global-search`, `verify:workspace-assistant-engine`, `verify:workspace-intelligence`, `verify:design-system`, `verify:notifications`.

## Explicit exclusions

No blog, comments, likes, ratings, news feeds, CMS UI, markdown editor, or AI-generated articles.
