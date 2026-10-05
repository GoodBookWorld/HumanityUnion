/**
 * Evaluated before civic store imports so those stores capture mongodb mode
 * while their adapter caches are still empty.
 */
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_BOOTSTRAP_SEED = "false";
process.env.DECISION_SESSION_PERSISTENCE = "mongodb";
process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "mongodb";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "mongodb";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
