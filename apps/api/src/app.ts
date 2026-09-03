import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { resolveCorsOriginOption } from "./config/web-origins.js";
import { browserOriginGuardMiddleware } from "./modules/auth/auth-browser-origin.middleware.js";
import authRouter from "./modules/auth/auth.routes.js";
import { emailRouter } from "./modules/email/index.js";
import {
  collaborativeAnalysisRouter,
  initiativeCollaborativeAnalysisRouter,
  publicCollaborativeAnalysisRouter,
} from "./modules/collaborative-analysis/index.js";
import {
  collectiveDecisionRouter,
  initiativeCollectiveDecisionRouter,
  publicCollectiveDecisionRouter,
} from "./modules/collective-decision/index.js";
import {
  civicCompatibilityReviewRouter,
  publicCivicCompatibilityReviewRouter,
  publicCivicCompatibilityReviewsByInitiativeRouter,
} from "./modules/civic-compatibility-review/index.js";
/**
 * Assistant Production Hardening Pack 02 — legacy routers remain in source
 * (workspace-assistant, workspace-intelligence, lifecycle-ai.routes) but are
 * intentionally NOT mounted. Canonical Assistant HTTP surface only:
 */
import { assistantRouter } from "./modules/lifecycle-ai/index.js";
import languageRouter from "./modules/language/language.routes.js";
import { globalSearchRouter } from "./modules/global-search/index.js";
import { platformStatisticsRouter } from "./modules/platform-statistics/index.js";
import { countryStatisticsRouter } from "./modules/country-statistics/index.js";
import { membershipStatisticsRouter } from "./modules/membership-statistics/index.js";
import { knowledgeCenterRouter } from "./modules/knowledge-center/index.js";
import { ipGeographyRouter } from "./modules/ip-geography/index.js";
import { notificationRouter } from "./modules/notifications/index.js";
import { reminderRouter } from "./modules/reminders/index.js";
import {
  communityIntelligenceRouter,
  publicCommunityIntelligenceRouter,
} from "./modules/community-intelligence/index.js";
import {
  decisionSessionRouter,
  publicDecisionSessionRouter,
  publicDecisionSessionsByInitiativeRouter,
} from "./modules/decision-session/index.js";
import {
  initiativeCollectiveDecisionVoteRouter,
  publicInitiativeCollectiveDecisionRouter,
  publicInitiativeCollectiveDecisionsByInitiativeRouter,
} from "./modules/initiative-collective-decision/index.js";
import {
  initiativeImplementationCommitmentRouter,
  publicInitiativeImplementationCommitmentRouter,
  publicInitiativeImplementationCommitmentsByDecisionRouter,
  publicInitiativeImplementationCommitmentsByInitiativeRouter,
} from "./modules/initiative-implementation-commitment/index.js";
import {
  initiativeImplementationTrackingRouter,
  publicInitiativeImplementationTrackingRouter,
  publicInitiativeImplementationTrackingsByCommitmentRouter,
  publicInitiativeImplementationTrackingsByInitiativeRouter,
} from "./modules/initiative-implementation-tracking/index.js";
import {
  initiativePublicImpactRouter,
  publicInitiativePublicImpactRouter,
  publicInitiativePublicImpactsByInitiativeRouter,
  publicInitiativePublicImpactsByTrackingRouter,
} from "./modules/initiative-public-impact/index.js";
import { capability02IntegrationRouter } from "./modules/capability02-integration/index.js";
import {
  publicCivicActionPackageByDecisionRouter,
  publicCivicActionPackageRouter,
  publicCivicActionPackagesByInitiativeRouter,
} from "./modules/civic-action-package/index.js";
import {
  civicNominationRouter,
  publicCivicNominationRouter,
  publicInstitutionCivicNominationsRouter,
} from "./modules/civic-nomination/index.js";
import {
  civicDeliveryRouter,
  publicCivicDeliveriesByCapRouter,
  publicCivicDeliveryRouter,
} from "./modules/civic-delivery/index.js";
import {
  civicAccountabilityRouter,
  publicCivicAccountabilitiesByCapRouter,
  publicCivicAccountabilitiesByInitiativeRouter,
  publicCivicAccountabilitiesByResponseRouter,
  publicCivicAccountabilityRouter,
} from "./modules/civic-accountability/index.js";
import {
  officialResponseRouter,
  publicOfficialResponseRouter,
  publicOfficialResponsesByCapRouter,
  publicOfficialResponsesByInitiativeRouter,
} from "./modules/official-response/index.js";
import {
  publicCivicArchiveRouter,
  publicCivicArchiveByImpactRouter,
  publicCivicArchiveByInitiativeRouter,
  publicCivicArchivePublicRouter,
} from "./modules/public-civic-archive/index.js";
import { publicNewsRouter } from "./modules/public-news/index.js";
import { mediaRegistryRouter } from "./modules/media-registry/index.js";
import {
  initiativeCollaborativeAnalysisLifecycleRouter,
  publicInitiativeCollaborativeAnalysisRouter,
  publicInitiativeCollaborativeAnalysesByInitiativeRouter,
} from "./modules/initiative-collaborative-analysis/index.js";
import {
  initiativeImprovementProposalRouter,
  publicInitiativeImprovementProposalRouter,
  publicInitiativeImprovementProposalsByAnalysisRouter,
  publicInitiativeImprovementProposalsByInitiativeRouter,
} from "./modules/initiative-improvement-proposal/index.js";
import {
  initiativeImprovementProposalsStageRouter,
  publicInitiativeImprovementProposalsStageByInitiativeRouter,
  publicInitiativeImprovementProposalsStageRouter,
} from "./modules/initiative-improvement-proposals-stage/index.js";
import {
  initiativeVersionRevisionRouter,
  publicInitiativeVersionRevisionRouter,
} from "./modules/initiative-version-revision/index.js";
import {
  implementationCommitmentRouter,
  publicImplementationCommitmentRouter,
} from "./modules/implementation-commitment/index.js";
import {
  implementationRouter,
  publicImplementationRouter,
} from "./modules/implementation/index.js";
import { petitionRouter, publicPetitionRouter } from "./modules/petition/index.js";
import { initiativePetitionLifecycleRouter } from "./modules/initiative-petition-lifecycle/index.js";
import { initiativeDiscussionLifecycleRouter } from "./modules/initiative-discussion-lifecycle/index.js";
import { collectiveParticipationJourneyRouter } from "./modules/collective-participation-journey/index.js";
import { initiativeDecisionSessionLifecycleRouter } from "./modules/initiative-decision-session-lifecycle/index.js";
import { initiativeCollectiveDecisionLifecycleRouter } from "./modules/initiative-collective-decision-lifecycle/index.js";
import { initiativeImplementationCommitmentLifecycleRouter } from "./modules/initiative-implementation-commitment-lifecycle/index.js";
import { initiativeImplementationTrackingLifecycleRouter } from "./modules/initiative-implementation-tracking-lifecycle/index.js";
import { initiativeOfficialResponseLifecycleRouter } from "./modules/initiative-official-response-lifecycle/index.js";
import { initiativePublicImpactLifecycleRouter } from "./modules/initiative-public-impact-lifecycle/index.js";
import { initiativeCivicArchiveLifecycleRouter } from "./modules/initiative-civic-archive-lifecycle/index.js";
import initiativesRouter from "./modules/initiatives/initiative.routes.js";
import publicInitiativeExperienceRouter from "./modules/initiatives/public-initiative-experience.routes.js";
import initiativeLifecycleStageProjectionRouter from "./modules/initiatives/initiative-lifecycle-stage-projection.routes.js";
import publicInitiativeRouter from "./modules/initiatives/public-initiative.routes.js";
import publicLatestInitiativesRouter from "./modules/initiatives/public-latest-initiatives.routes.js";
import publicWorldInitiativesRouter from "./modules/initiatives/public-world-initiatives.routes.js";
import { publicSitemapRouter } from "./modules/sitemap/index.js";
import { initiativeSupportRouter } from "./modules/initiative-support/index.js";
import { publicChoiceCandidateRouter, publicChoiceCandidatesByInitiativeRouter } from "./modules/public-choice-candidate/index.js";
import { publicChoiceResultsRetentionRouter } from "./modules/public-choice-results-retention/index.js";
import { initiativeCommentRouter } from "./modules/initiative-comments/index.js";
import { initiativeDiscussionCollaborationRouter } from "./modules/initiative-discussion-collaboration/index.js";
import { initiativeCollaborationChannelRouter } from "./modules/initiative-collaboration-channel/index.js";
import { initiativeCollaborationSessionsRouter } from "./modules/initiative-collaboration-sessions/index.js";
import { memberProfileRouter, publicMemberProfileRouter } from "./modules/member-profile/index.js";
import { directMessagingRouter } from "./modules/direct-messaging/index.js";
import { blogRouter, publicBlogRouter } from "./modules/blog/index.js";
import { adminPublishingRouter } from "./modules/blog/admin-publishing.routes.js";
import {
  sharedDocumentsDirectMessagesRouter,
  sharedDocumentsInitiativesRouter,
} from "./modules/shared-documents/index.js";
import { membershipRouter } from "./modules/membership/index.js";
import { membershipStripeWebhookRouter } from "./modules/membership-payment/index.js";
import { memberBadgeContributionRouter } from "./modules/member-badge-contribution/index.js";
import {
  adminMemberBadgeApplicationRouter,
  memberBadgeApplicationRouter,
} from "./modules/member-badge-application/index.js";
import { LOCAL_MEDIA_UPLOAD_ROOT, mediaUploadRouter } from "./modules/media-upload/index.js";
import { mediaStaticHeadersMiddleware } from "./modules/media-upload/media-static.middleware.js";
import memberRouter from "./modules/member/member.routes.js";
import participationRouter from "./modules/participation/participation.routes.js";
import { participationAreaRouter } from "./modules/participation-area/index.js";
import { workspaceHomeRouter } from "./modules/workspace-home/index.js";
import { workspaceRouter } from "./modules/workspace/index.js";
import { activityRouter } from "./modules/activity/index.js";
import { discussionRouter } from "./modules/discussion/index.js";
import { proposalRouter } from "./modules/proposal/index.js";
import { decisionRouter } from "./modules/decision/index.js";
import betaInviteRouter from "./modules/beta-invite/beta-invite.routes.js";
import adminParticipantDirectoryRouter from "./modules/administration/admin-participant-directory.routes.js";
import {
  adminParticipantSuspensionRouter,
  participantSuspensionReviewRouter,
} from "./modules/participant-suspension/index.js";
import adminAuditRouter from "./modules/administration/admin-audit.routes.js";
import adminInitiativeDirectoryRouter from "./modules/administration/admin-initiative-directory.routes.js";
import adminPublicChoiceRouter from "./modules/administration/admin-public-choice.routes.js";
import { adminNotificationsRouter } from "./modules/admin-notifications/admin-notification.routes.js";
import { adminEditorGrantsRouter, editorPanelRouter } from "./modules/editor-grants/index.js";
import adminMediaResourcesRouter from "./modules/media-resources/admin-media-resources.routes.js";
import adminCountryAffiliationRouter from "./modules/country-affiliation/admin-country-affiliation.routes.js";
import {
  adminTrafficAnalyticsRouter,
  publicTrafficAnalyticsRouter,
} from "./modules/traffic-analytics/index.js";
import closedBetaRouter from "./modules/closed-beta/closed-beta.routes.js";
import adminPlatformReadinessRouter from "./modules/closed-beta/admin-platform-readiness.routes.js";
import adminDiagnosticsHealthRouter from "./modules/administration/admin-diagnostics-health.routes.js";
import {
  adminPlatformSupportLinksRouter,
  publicPlatformSupportLinksRouter,
} from "./modules/platform-support-links/index.js";
import {
  adminPlatformSocialAccountsRouter,
  publicPlatformSocialAccountsRouter,
} from "./modules/platform-social-accounts/index.js";
import {
  adminBrandLocalizationRouter,
  publicBrandLocalizationRouter,
} from "./modules/brand-localization/index.js";
import {
  adminLegalLocalizationRouter,
  publicLegalLocalizationRouter,
} from "./modules/legal-localization/index.js";
import {
  adminLanguagesRouter,
  adminTerminologyGlossaryRouter,
  publicLanguagesRouter,
  runtimeLocaleRouter,
} from "./modules/language/index.js";
import {
  adminSeoPageOverridesRouter,
  publicSeoPageOverridesRouter,
} from "./modules/seo-page-overrides/index.js";
import preferencesRouter from "./modules/preferences/preferences.routes.js";
import healthRouter from "./routes/health.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    // Launch Blocker Recovery Pack 01 — reflect request Origin when allowlisted.
    // Never `*`. Shared allowlist with browserOriginGuardMiddleware.
    origin: resolveCorsOriginOption,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(browserOriginGuardMiddleware);
app.use(
  "/api/v1/webhooks/stripe/membership",
  express.raw({ type: "application/json" }),
  membershipStripeWebhookRouter,
);
app.use(express.json());
// Local/dev filesystem media only — R2 public media is served from R2_PUBLIC_BASE_URL.
if ((process.env.MEDIA_STORAGE_PROVIDER ?? "local").trim().toLowerCase() !== "r2") {
  app.use(
    "/api/v1/media/files",
    mediaStaticHeadersMiddleware,
    express.static(LOCAL_MEDIA_UPLOAD_ROOT, {
      index: false,
      dotfiles: "deny",
      fallthrough: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        } else if (filePath.endsWith(".webp")) {
          res.setHeader("Content-Type", "image/webp");
        } else if (filePath.endsWith(".gif")) {
          res.setHeader("Content-Type", "image/gif");
        } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
          res.setHeader("Content-Type", "image/jpeg");
        }
      },
    }),
  );
}
app.use("/api/v1/media", mediaUploadRouter);
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/platform", closedBetaRouter);
app.use("/api/v1/platform/social-accounts", publicPlatformSocialAccountsRouter);
app.use("/api/v1/platform/support-links", publicPlatformSupportLinksRouter);
app.use("/api/v1/languages", publicLanguagesRouter);
app.use("/api/v1/brand-localization", publicBrandLocalizationRouter);
app.use("/api/v1/legal-localization", publicLegalLocalizationRouter);
app.use("/api/v1/runtime-locale", runtimeLocaleRouter);
app.use("/api/v1/admin/languages", adminLanguagesRouter);
app.use("/api/v1/admin/brand-localization", adminBrandLocalizationRouter);
app.use("/api/v1/admin/legal-localization", adminLegalLocalizationRouter);
app.use("/api/v1/admin/terminology-glossary", adminTerminologyGlossaryRouter);
app.use("/api/v1/admin/platform/readiness", adminPlatformReadinessRouter);
app.use("/api/v1/admin/platform/social-accounts", adminPlatformSocialAccountsRouter);
app.use("/api/v1/admin/platform/support-links", adminPlatformSupportLinksRouter);
app.use("/api/v1/admin/diagnostics", adminDiagnosticsHealthRouter);
app.use("/api/v1/admin/seo/page-overrides", adminSeoPageOverridesRouter);
app.use("/api/v1/public/seo/page-overrides", publicSeoPageOverridesRouter);
app.use("/api/v1/beta-invites", betaInviteRouter);
app.use("/api/v1/admin/participants", adminParticipantDirectoryRouter);
app.use("/api/v1/admin/participants", adminParticipantSuspensionRouter);
app.use("/api/v1/admin/member-badge-applications", adminMemberBadgeApplicationRouter);
app.use("/api/v1/public/suspension-review", participantSuspensionReviewRouter);
app.use("/api/v1/admin/audit", adminAuditRouter);
app.use("/api/v1/admin/editors", adminEditorGrantsRouter);
app.use("/api/v1/admin/publishing", adminPublishingRouter);
app.use("/api/v1/admin/notifications", adminNotificationsRouter);
app.use("/api/v1/workspace/editor", editorPanelRouter);
app.use("/api/v1/admin/initiatives", adminInitiativeDirectoryRouter);
app.use("/api/v1/admin/public-choice", adminPublicChoiceRouter);
app.use("/api/v1/admin/media-resources", adminMediaResourcesRouter);
app.use("/api/v1/admin/country-people", adminCountryAffiliationRouter);
app.use("/api/v1/admin/analytics", adminTrafficAnalyticsRouter);
app.use("/api/v1/public/analytics", publicTrafficAnalyticsRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/email", emailRouter);
app.use("/api/v1/member-profile", memberProfileRouter);
app.use("/api/v1/direct-messages", directMessagingRouter);
app.use("/api/v1/direct-messages", sharedDocumentsDirectMessagesRouter);
app.use("/api/v1/blog", blogRouter);
app.use("/api/v1/public/blog", publicBlogRouter);
app.use("/api/v1/membership", membershipRouter);
app.use("/api/v1/member-badge-contributions", memberBadgeContributionRouter);
app.use("/api/v1/member-badge-applications", memberBadgeApplicationRouter);
app.use("/api/v1/participation-area", participationAreaRouter);
app.use("/api/v1/workspace", workspaceRouter);
app.use("/api/v1/activities", activityRouter);
app.use("/api/v1/discussions", discussionRouter);
app.use("/api/v1/proposals", proposalRouter);
app.use("/api/v1/decisions", decisionRouter);
/** @deprecated Legacy initiative-centric home — use canonical GET /api/v1/workspace */
app.use("/api/v1/workspace", workspaceHomeRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/reminders", reminderRouter);
app.use("/api/v1/community-intelligence", communityIntelligenceRouter);
app.use("/api/v1/public", publicCommunityIntelligenceRouter);
app.use("/api/v1/members", memberRouter);
app.use("/api/v1/initiatives", initiativeCollaborativeAnalysisRouter);
app.use("/api/v1/initiatives", initiativeCollectiveDecisionRouter);
app.use("/api/v1/initiatives", publicChoiceCandidateRouter);
app.use("/api/v1/initiatives", publicChoiceResultsRetentionRouter);
app.use("/api/v1/initiatives", initiativesRouter);
app.use("/api/v1/initiative-analyses", initiativeCollaborativeAnalysisLifecycleRouter);
app.use("/api/v1/improvement-proposals", initiativeImprovementProposalRouter);
app.use("/api/v1/improvement-proposal-collections", initiativeImprovementProposalsStageRouter);
app.use("/api/v1/decision-sessions", decisionSessionRouter);
app.use("/api/v1/initiative-collective-decisions", initiativeCollectiveDecisionVoteRouter);
app.use("/api/v1/initiative-implementation-commitments", initiativeImplementationCommitmentRouter);
app.use("/api/v1/initiative-implementation-tracking", initiativeImplementationTrackingRouter);
app.use("/api/v1/initiative-public-impact", initiativePublicImpactRouter);
app.use("/api/v1/civic-deliveries", civicDeliveryRouter);
app.use("/api/v1/official-responses", officialResponseRouter);
app.use("/api/v1/civic-accountability", civicAccountabilityRouter);
app.use("/api/v1/public-civic-archive", publicCivicArchiveRouter);
app.use("/api/v1/civic-compatibility-reviews", civicCompatibilityReviewRouter);
// Quarantined (Pack 02): /api/v1/workspace-assistant and /api/v1/lifecycle-ai
// are no longer mounted. Source retained for later removal.
app.use("/api/v1/assistant", assistantRouter);
app.use("/api/v1/translations", languageRouter);
app.use("/api/v1/civic-nominations", civicNominationRouter);
app.use("/api/v1/public/civic-nominations", publicCivicNominationRouter);
app.use("/api/v1/public/institutions", publicInstitutionCivicNominationsRouter);
app.use("/api/v1/initiative-revisions", initiativeVersionRevisionRouter);
app.use("/api/v1/collaborative-analysis", collaborativeAnalysisRouter);
app.use("/api/v1/collective-decisions", collectiveDecisionRouter);
app.use("/api/v1/petitions", petitionRouter);
app.use("/api/v1/initiative-petitions", initiativePetitionLifecycleRouter);
app.use("/api/v1/initiative-discussion-lifecycle", initiativeDiscussionLifecycleRouter);
app.use("/api/v1/participants", collectiveParticipationJourneyRouter);
app.use("/api/v1/initiative-decision-sessions", initiativeDecisionSessionLifecycleRouter);
app.use("/api/v1/initiative-collective-decision-lifecycle", initiativeCollectiveDecisionLifecycleRouter);
app.use(
  "/api/v1/initiative-implementation-commitment-lifecycle",
  initiativeImplementationCommitmentLifecycleRouter,
);
app.use(
  "/api/v1/initiative-implementation-tracking-lifecycle",
  initiativeImplementationTrackingLifecycleRouter,
);
app.use(
  "/api/v1/initiative-official-response-lifecycle",
  initiativeOfficialResponseLifecycleRouter,
);
app.use(
  "/api/v1/initiative-public-impact-lifecycle",
  initiativePublicImpactLifecycleRouter,
);
app.use(
  "/api/v1/initiative-civic-archive-lifecycle",
  initiativeCivicArchiveLifecycleRouter,
);
app.use("/api/v1/implementation-commitments", implementationCommitmentRouter);
app.use("/api/v1/implementations", implementationRouter);
app.use("/api/v1/public/knowledge", knowledgeCenterRouter);
app.use("/api/v1/public/ip-geography", ipGeographyRouter);
app.use("/api/v1/statistics", membershipStatisticsRouter);
app.use("/api/v1/public", globalSearchRouter);
app.use("/api/v1/public", platformStatisticsRouter);
app.use("/api/v1/public", countryStatisticsRouter);
app.use("/api/v1/public/implementations", publicImplementationRouter);
app.use("/api/v1/public/implementation-commitments", publicImplementationCommitmentRouter);
app.use("/api/v1/public/petitions", publicPetitionRouter);
app.use("/api/v1/public/member-profiles", publicMemberProfileRouter);
app.use("/api/v1/public/collective-decisions", publicCollectiveDecisionRouter);
app.use("/api/v1/public/collaborative-analysis", publicCollaborativeAnalysisRouter);
app.use("/api/v1/public/initiative-analyses", publicInitiativeCollaborativeAnalysisRouter);
app.use("/api/v1/public/initiative-analyses", publicInitiativeImprovementProposalsByAnalysisRouter);
app.use("/api/v1/public/improvement-proposals", publicInitiativeImprovementProposalRouter);
app.use("/api/v1/public/improvement-proposal-collections", publicInitiativeImprovementProposalsStageRouter);
app.use("/api/v1/public/decision-sessions", publicDecisionSessionRouter);
app.use("/api/v1/public/initiative-collective-decisions", publicInitiativeCollectiveDecisionRouter);
app.use("/api/v1/public/initiative-collective-decisions", publicCivicActionPackageByDecisionRouter);
app.use(
  "/api/v1/public/initiative-collective-decisions",
  publicInitiativeImplementationCommitmentsByDecisionRouter,
);
app.use(
  "/api/v1/public/initiative-implementation-commitments",
  publicInitiativeImplementationCommitmentRouter,
);
app.use(
  "/api/v1/public/initiative-implementation-commitments",
  publicInitiativeImplementationTrackingsByCommitmentRouter,
);
app.use(
  "/api/v1/public/initiative-implementation-tracking",
  publicInitiativeImplementationTrackingRouter,
);
app.use(
  "/api/v1/public/initiative-implementation-tracking",
  publicInitiativePublicImpactsByTrackingRouter,
);
app.use("/api/v1/public/public-impact", publicInitiativePublicImpactRouter);
app.use("/api/v1/public/civic-archive", publicCivicArchivePublicRouter);
app.use("/api/v1/public/news", publicNewsRouter);
app.use("/api/v1/public/media/registry", mediaRegistryRouter);
app.use("/api/v1/public/civic-action-packages", publicCivicActionPackageRouter);
app.use("/api/v1/public/civic-action-packages", publicCivicDeliveriesByCapRouter);
app.use("/api/v1/public/civic-action-packages", publicOfficialResponsesByCapRouter);
app.use("/api/v1/public/civic-action-packages", publicCivicAccountabilitiesByCapRouter);
app.use("/api/v1/public/official-responses", publicCivicAccountabilitiesByResponseRouter);
app.use("/api/v1/public/official-responses", publicOfficialResponseRouter);
app.use("/api/v1/public/civic-accountability", publicCivicAccountabilityRouter);
app.use("/api/v1/public/civic-deliveries", publicCivicDeliveryRouter);
app.use("/api/v1/public/integration", capability02IntegrationRouter);
app.use("/api/v1/public/compatibility-reviews", publicCivicCompatibilityReviewRouter);
app.use("/api/v1/public/initiatives", publicInitiativeCollaborativeAnalysesByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeImprovementProposalsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeImprovementProposalsStageByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicDecisionSessionsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeCollectiveDecisionsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicChoiceCandidatesByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeImplementationCommitmentsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeImplementationTrackingsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativePublicImpactsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicCivicArchiveByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicCivicActionPackagesByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicOfficialResponsesByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicCivicAccountabilitiesByInitiativeRouter);
app.use("/api/v1/public/public-impact", publicCivicArchiveByImpactRouter);
app.use("/api/v1/public/initiatives", publicCivicCompatibilityReviewsByInitiativeRouter);
app.use("/api/v1/public/initiatives", publicInitiativeVersionRevisionRouter);
app.use("/api/v1/public/initiatives", publicInitiativeExperienceRouter);
app.use("/api/v1/public/initiatives", initiativeLifecycleStageProjectionRouter);
app.use("/api/v1/public/initiatives", initiativeSupportRouter);
app.use("/api/v1/public/initiatives", initiativeCommentRouter);
app.use("/api/v1/public/initiatives", initiativeDiscussionCollaborationRouter);
app.use("/api/v1/public/initiatives", initiativeCollaborationChannelRouter);
app.use("/api/v1/public/initiatives", initiativeCollaborationSessionsRouter);
app.use("/api/v1/public/initiatives", sharedDocumentsInitiativesRouter);
app.use("/api/v1/public/initiatives", publicInitiativeRouter);
app.use("/api/v1/public/projections", publicLatestInitiativesRouter);
app.use("/api/v1/public/projections", publicWorldInitiativesRouter);
app.use("/api/v1/public/sitemap", publicSitemapRouter);
app.use("/api/v1/participation", participationRouter);
app.use("/api/v1/preferences", preferencesRouter);

export default app;
