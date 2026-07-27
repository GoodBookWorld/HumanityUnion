# Membership

TASK-098 membership hero illustration.

Route: `/membership`

## Hero illustration

The membership hero includes the approved illustration:

`/illustrations/membership/member-badge.webp`

Layout:

| Viewport | Treatment                         |
| -------- | --------------------------------- |
| Desktop  | Text left, illustration right     |
| Tablet   | Illustration beside or below text |
| Mobile   | Illustration below text           |

The image preserves aspect ratio, lazy loads, includes alt text, and never overflows the hero container.

## Related files

- Hero component: `apps/web/src/features/membership/components/MembershipHero.tsx`
- Styles: `apps/web/src/features/membership/components/membership-page.css`
- Constant: `MEMBER_BADGE_IMAGE_PATH` in `apps/web/src/features/membership/membership.constants.ts`
