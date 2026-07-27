# Civic Activity

TASK-098 civic activity summary polish.

Route: `/civic-activity`

## Activity Summary icons

Each summary card displays a workspace icon to the left of the title:

| Group                         | Icon                                 |
| ----------------------------- | ------------------------------------ |
| My Initiatives                | `/icons/workspace/initiatives.svg`   |
| My Collaborative Analyses     | `/icons/workspace/analyses.svg`      |
| My Improvement Proposals      | `/icons/workspace/proposals.svg`     |
| My Decision Participation     | `/icons/workspace/participation.svg` |
| My Implementation Commitments | `/icons/workspace/commitments.svg`   |
| My Implementation Tracking    | `/icons/workspace/tracking.svg`      |
| My Public Impact              | `/icons/workspace/impact.svg`        |

Icons are decorative (`aria-hidden="true"`). Titles remain visible text.

## Section anchors

The Sections menu uses IDs aligned with profile sections:

- `#section-my-civic-activity`
- `#section-activity-summary`
- `#section-activity-timeline`

Profile sections use `scroll-margin-top` so headings remain visible below the fixed global header. No JavaScript scroll delays are used.

## Related files

- Page: `apps/web/src/app/civic-activity/page.tsx`
- Workspace UI: `apps/web/src/features/civic-activity/components/MyCivicActivityWorkspace.tsx`
- Section layout: `apps/web/src/features/civic-activity/components/MyCivicActivitySection.tsx`
