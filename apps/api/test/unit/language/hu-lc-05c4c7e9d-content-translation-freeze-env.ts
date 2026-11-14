/**
 * HU-LC-05C.4C.7E.9D — memory persistence; Content Translation explicitly frozen.
 * Imported first: stores choose their adapter at module load.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_BOOTSTRAP_SEED = "false";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_REACTION_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_FROZEN = "true";
