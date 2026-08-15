/**
 * Canonical Humanity Union platform knowledge boundary (Pack 02 + Pack 05).
 *
 * Structured modules and bounded retrieval live under ./platform-knowledge/.
 * This file keeps principles / scope / safety summaries and re-exports the catalog.
 *
 * Communication character lives in assistant-core-policy.ts (Pack 03).
 */

import { ASSISTANT_OUT_OF_SCOPE_REPLY } from "./assistant-core-policy.js";

export type { PlatformKnowledgeModule, PlatformKnowledgeCategory } from "./platform-knowledge/index.js";
export {
  PLATFORM_KNOWLEDGE_VERSION,
  ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY,
  PLATFORM_KNOWLEDGE_MODULES,
  PLATFORM_KNOWLEDGE_TOPICS,
  PLATFORM_KNOWLEDGE_TOPIC_LABELS,
  PLATFORM_AI_KNOWLEDGE_PROMPT,
  retrievePlatformKnowledge,
} from "./platform-knowledge/index.js";

/** @deprecated Prefer PlatformKnowledgeModule — kept for Pack 02 call-site compatibility. */
export interface PlatformKnowledgeTopic {
  readonly topicId: string;
  readonly label: string;
  readonly summary: string;
}

export const HUMANITY_UNION_PRINCIPLES: readonly string[] = [
  "Human dignity — treat every Participant with respect; never assess personal worth.",
  "Transparency — explain platform rules and Lifecycle consequences clearly.",
  "Responsibility — focus on actions and consequences, not praise or blame of the person.",
  "Participation — help people take part constructively and voluntarily.",
  "Evidence — prefer sourced claims over popularity or assertion.",
  "Constructive collaboration — improve Initiatives without personal rivalry.",
  "Non-violence — reject coercive, hateful, or intimidating civic language.",
  "Accountability — Authors remain responsible for every published civic record.",
  "Knowledge sharing — preserve lessons for others without fabricating certainty.",
  "AI is advisory only — it never publishes, votes, or decides.",
  "Private messages, credentials, and personal documents are never sent to AI automatically.",
  "Safety validation runs before content may enter Stage Intelligence or AI prompts.",
];

export const ASSISTANT_SCOPE_BOUNDARY = [
  "You help users understand Humanity Union, participate responsibly, improve Initiatives,",
  "collaborate, use platform tools, understand civic-process concepts on the platform,",
  "and develop relevant reasoning and decision-making skills.",
  "If a request is unrelated to Humanity Union or civic work here, reply briefly and politely:",
  `"${ASSISTANT_OUT_OF_SCOPE_REPLY}"`,
  "If a seemingly unrelated question may connect to an Initiative, invite the Participant",
  "to explain that connection rather than becoming hostile or robotic.",
  "Do not pretend unrelated expertise is part of Humanity Union.",
  "Do not automatically read private conversation history.",
].join(" ");

export const ASSISTANT_SAFETY_POLICY_SUMMARY =
  "Safety validation runs before any external model call. Private chats and credentials are never sent automatically. Rejected prompts never reach the provider.";
