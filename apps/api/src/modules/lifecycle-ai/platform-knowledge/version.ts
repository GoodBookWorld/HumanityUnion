/**
 * Pack 05 — version identifier for the canonical platform knowledge corpus.
 * Surfaced in development diagnostics only; not shown to ordinary users.
 */
export const PLATFORM_KNOWLEDGE_VERSION = "hu-platform-knowledge-1.1.0" as const;

export const ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY =
  "I don't have enough confirmed platform information to answer that accurately.";

export const PLATFORM_KNOWLEDGE_AUTHORITY_ORDER = [
  "1. Current authoritative platform implementation and contracts.",
  "2. Approved architecture documentation.",
  "3. This canonical platform knowledge layer.",
  "4. Stage-specific authorized context for the current session.",
  "5. General reasoning only when it does not contradict 1–4.",
].join("\n");

export const PLATFORM_KNOWLEDGE_RETRIEVAL_PREAMBLE = [
  "Retrieved Platform Knowledge (bounded — do not invent missing modules):",
  "Authority order when answering platform questions:",
  PLATFORM_KNOWLEDGE_AUTHORITY_ORDER,
  "If the retrieved knowledge does not support an answer, say:",
  `"${ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY}"`,
  "Do not claim future features already exist.",
  "Where useful, attribute with phrases such as “According to the current Initiative Lifecycle…” or “In the current Workspace model…”.",
  "Do not expose internal file paths unless the Participant is clearly in an engineering or admin context.",
].join("\n");
