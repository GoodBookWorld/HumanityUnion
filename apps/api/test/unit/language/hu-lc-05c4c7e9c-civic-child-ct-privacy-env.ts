/**
 * HU-LC-05C.4C.7E.9C — memory persistence for every Initiative child store.
 * Imported first: stores choose their adapter at module load.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_BOOTSTRAP_SEED = "false";
process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.DECISION_SESSION_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "memory";
process.env.OFFICIAL_RESPONSE_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE = "memory";
process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
process.env.CIVIC_ACTION_PACKAGE_PERSISTENCE = "memory";
process.env.CIVIC_DELIVERY_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_REACTION_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_FROZEN = "false";
