# Member Profile

TASK-098 member profile social links and participation geography.

Route: `/member`

## Website and LinkedIn fields

The profile form stores:

- `website` — standard http/https URL
- `linkedinUrl` — must begin with `https://www.linkedin.com/`

Both fields render with civic icons beside the input:

- Website → `/icons/civic/website.svg`
- LinkedIn → `/icons/civic/icons8-linkedin.svg`

## Skills & Interests integration

The **Skills & Interests** summary shows preference summaries plus dynamic external links when configured:

- Website icon links to the saved website URL
- LinkedIn icon links to the saved LinkedIn profile URL

Links are hidden when empty and open in a new tab with `rel="noopener noreferrer"`.

## Participation Area community selector

Inside **Change Participation Area**, geography follows:

Country → Region → City / Community

The community control uses the shared `GeographySearchSelect` component and only lists communities for the selected region. Changing region clears an incompatible community value.

## Related files

- Profile workspace: `apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx`
- Settings summaries: `apps/web/src/features/member-profile/components/MemberSettingsSummaries.tsx`
- Participation area: `apps/web/src/features/participation-area/components/ParticipationAreaSection.tsx`
- Validators: `apps/api/src/modules/member-profile/member-profile.validators.ts`
