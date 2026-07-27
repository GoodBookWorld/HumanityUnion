# Workspace

TASK-098 workspace header simplification.

Route: `/workspace`

## Personal header

The workspace personal header (`WorkspacePersonalHeader`) retains only the action row:

- Current Workspace label
- Workspace Home link
- Logout button

The previous identity block (avatar, display name, participation area, membership badge) was removed so the remaining actions expand naturally without empty spacing.

## Related files

- Component: `apps/web/src/features/workspace-home/components/WorkspacePersonalHeader.tsx`
- Styles: `apps/web/src/features/workspace-home/components/workspace-personal-header.css`
