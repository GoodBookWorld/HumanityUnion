import type { InitiativeLifecycleAiAssistSuggestion } from "@hu/types";

import { parseSectionedSuggestions } from "../build-lifecycle-ai-prompt.js";
import type { LifecycleAiProvider, LifecycleAiProviderRequest } from "../lifecycle-ai-provider.js";
import { ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY } from "../platform-knowledge/version.js";

/**
 * Offline / test / default provider. Produces structured suggestions without
 * calling any external AI. GeminiProvider is the first real networked provider.
 *
 * Pack 03: answer_question responses follow educational peer style for
 * provider-independent conversation tests.
 */
export class DeterministicLifecycleAiProvider implements LifecycleAiProvider {
  readonly providerId = "deterministic" as const;

  async assist(request: LifecycleAiProviderRequest): Promise<{
    readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
    readonly isPlaceholder: boolean;
  }> {
    const feature = request.featureLabel ?? request.stageLabel;
    const provenance = `Humanity Union Assistant suggestion for ${feature} (${request.operation}). Review before applying.`;
    const content = buildDeterministicContent(request);
    const suggestions = parseSectionedSuggestions(
      content,
      request.operation,
      request.stageId,
      provenance,
    );

    return { suggestions, isPlaceholder: false };
  }
}

function buildDeterministicContent(request: LifecycleAiProviderRequest): string {
  const sources =
    request.availableSourceLabels.length > 0
      ? request.availableSourceLabels.join("; ")
      : "no listed sources yet";
  const question = request.instructions?.trim() ?? "";

  if (request.surfaceId === "blog" && /AUTHORING|publication editor/i.test(request.sourceContextSummary)) {
    return buildBlogAuthoringDeterministicContent(request);
  }

  switch (request.operation) {
    case "generate_draft":
      return buildDeterministicWholeDocumentDraft(request, sources);

    case "improve_wording":
      return [
        "Section: assistant",
        request.currentDraftExcerpt
          ? `Improved wording suggestion:\n\n${request.currentDraftExcerpt.trim()}\n\nOne possible improvement is clearer, more neutral civic language. Author must edit before saving.`
          : "Provide a draft excerpt to improve, then ask Improve again.",
      ].join("\n");

    case "summarize_source_themes":
      return [
        "Section: assistant",
        `Source themes for ${request.stageLabel}: ${sources}.`,
        "The available evidence suggests these themes appear in the provided sources; competing interpretations may remain.",
        request.sourceContextSummary.slice(0, 800) || "No source summary was available.",
      ].join("\n");

    case "explain":
      return [
        "Section: assistant",
        `${request.stageLabel} helps Participants prepare civic content after earlier Lifecycle work.`,
        "Why it matters: each stage makes responsibilities and public records clearer before the next action.",
        `Presentation mode: ${request.presentationMode}.`,
        "Next practical step: Ask AI → review the suggestion → edit → Save → Preview → Publish.",
        "AI never publishes or edits your stored draft automatically.",
      ].join("\n");

    case "answer_question":
      return [
        "Section: assistant",
        buildEducationalAnswer(request, question, sources),
      ].join("\n");

    case "identify_missing_information":
      return [
        "Section: assistant",
        "Possible gaps worth examining: missing evidence quotes, unanswered open questions, and unclear references to Discussion sources.",
        "What evidence would change your view of readiness to publish?",
      ].join("\n");

    case "identify_contradictions":
      return [
        "Section: assistant",
        "That concern is worth examining from two sides: Helpful vs Not Helpful Discussion themes may reflect evidence conflicts or differing assumptions.",
        "Could there be another explanation before treating them as settled facts?",
      ].join("\n");

    case "regenerate_section":
      return [
        `Section: ${request.targetSectionId ?? "summary"}`,
        `Regenerated suggestion for ${request.targetSectionId ?? "summary"} on "${request.initiativeTitle}". Ground this section in: ${sources}.`,
      ].join("\n");

    default: {
      const _exhaustive: never = request.operation;
      return _exhaustive;
    }
  }
}

function buildBlogAuthoringDeterministicContent(request: LifecycleAiProviderRequest): string {
  const excerpt = request.currentDraftExcerpt?.trim() ?? "";
  const titleMatch = /^title:\s*(.+)$/im.exec(excerpt);
  const currentTitle = titleMatch?.[1]?.trim() || "Untitled publication";
  const section = request.targetSectionId?.trim() || inferBlogSectionFromInstructions(request.instructions);

  switch (section) {
    case "title":
      return [
        "Section: title",
        `${currentTitle.replace(/\s+/g, " ").trim()} — clearer focus`.slice(0, 120),
      ].join("\n");
    case "content":
      return [
        "Section: content",
        excerpt
          ? `Proposed clarity pass (review before Apply):\n\n${excerpt.slice(0, 2500)}\n\nSuggestion: shorten long sentences, keep one idea per paragraph, and preserve the Author's voice.`
          : "Provide article content in the draft excerpt, then ask for a text correction again.",
      ].join("\n");
    case "clarity":
      return [
        "Section: clarity",
        "Clarity suggestions: lead with the main claim, define specialized terms once, and prefer concrete examples over abstractions. Author reviews before Apply.",
      ].join("\n");
    case "structure":
      return [
        "Section: structure",
        "Structure suggestions: opening context → core argument → evidence or examples → practical takeaway. Use short subheadings where helpful.",
      ].join("\n");
    case "seoTitle":
      return [
        "Section: seoTitle",
        `${currentTitle} | Humanity Union`.slice(0, 60),
      ].join("\n");
    case "seoDescription":
      return [
        "Section: seoDescription",
        `A clear Humanity Union publication on ${currentTitle}. Read the Author's perspective and related civic context.`.slice(
          0,
          160,
        ),
      ].join("\n");
    case "keywords":
      return [
        "Section: keywords",
        "humanity union, civic publishing, conscious existence, human security, community",
      ].join("\n");
    case "socialTitle":
      return [
        "Section: socialTitle",
        currentTitle.slice(0, 70),
        "Section: socialDescription",
        `Explore “${currentTitle}” on the Humanity Union Blog.`.slice(0, 160),
      ].join("\n");
    case "socialDescription":
      return [
        "Section: socialDescription",
        `Explore “${currentTitle}” on the Humanity Union Blog.`.slice(0, 160),
      ].join("\n");
    default:
      if (request.operation === "answer_question" || request.operation === "explain") {
        return [
          "Section: assistant",
          request.instructions?.trim()
            ? `Regarding: ${request.instructions.trim()}\n\nIn publication authoring, the Assistant suggests optional text. You Apply, Replace, or Dismiss each suggestion. Nothing is saved or published automatically.`
            : "Ask for a title, clarity, structure, SEO, keyword, or social preview suggestion. You remain the Author of the final text.",
        ].join("\n");
      }
      return [
        "Section: title",
        `${currentTitle}`.slice(0, 120),
        "Section: seoDescription",
        `A Humanity Union Blog draft about ${currentTitle}.`.slice(0, 160),
      ].join("\n");
  }
}

function inferBlogSectionFromInstructions(instructions?: string): string {
  const text = instructions?.toLowerCase() ?? "";
  if (/seo title|search title/.test(text)) return "seoTitle";
  if (/meta description|seo description/.test(text)) return "seoDescription";
  if (/social title/.test(text)) return "socialTitle";
  if (/social (description|preview|card)/.test(text)) return "socialDescription";
  if (/keyword|topic/.test(text)) return "keywords";
  if (/structure|outline|heading/.test(text)) return "structure";
  if (/clarity|readability/.test(text)) return "clarity";
  if (/correct|wording|rewrite|grammar|article content|body/.test(text)) return "content";
  if (/title/.test(text)) return "title";
  return "assistant";
}

function buildDeterministicWholeDocumentDraft(
  request: LifecycleAiProviderRequest,
  sources: string,
): string {
  const context = request.sourceContextSummary.slice(0, 400);
  const title = request.initiativeTitle;

  switch (request.stageId) {
    case "analysis":
      return [
        "Section: title",
        `Collaborative Analysis — ${title}`,
        "Section: summary",
        `Suggested summary for "${title}" based on ${sources}. ${context}`,
        "Section: supportingEvidence",
        "List the strongest Helpful discussion arguments and proposal-marked contributions from the Source Snapshot.",
        "Section: risks",
        "List the main concerns and Not Helpful themes from Discussion.",
        "Section: openQuestions",
        "Capture unanswered questions still open in Discussion.",
        "Section: suggestedImprovements",
        "Note areas that need clarification before an Improvement Proposal stage.",
        "Section: references",
        "Reference Discussion comments, Active Allies, and Ready-to-Collaborate signals used above.",
      ].join("\n");
    case "proposal":
      return [
        "Section: title",
        `Improvement proposal for ${title}`,
        "Section: summary",
        `Concise proposal summary grounded in ${sources}.`,
        "Section: description",
        `Describe the proposed change using available Analysis/Discussion context. ${context}`,
        "Section: reason",
        "Explain why this improvement addresses evidenced community needs.",
        "Section: expectedImprovement",
        "State the expected civic improvement without inventing outcomes.",
        "Section: supportingSources",
        "Cite Discussion/Analysis sources from the authorized context only.",
      ].join("\n");
    case "petition":
      return [
        "Section: title",
        `Petition: ${title}`,
        "Section: publicSummary",
        `Public summary for a petition about "${title}" using ${sources}.`,
        "Section: requestStatement",
        "State the public request clearly and neutrally.",
        "Section: expectedOutcome",
        "Describe the intended civic outcome without inventing commitments from institutions.",
        "Section: supportingContext",
        context || "Add supporting context from available Initiative sources.",
        "Section: keyArguments",
        "List key arguments, one per line, grounded in available evidence.",
      ].join("\n");
    case "decision_session":
      return [
        "Section: title",
        `Decision Session: ${title}`,
        "Section: decisionQuestion",
        `What decision should Participants consider for "${title}"?`,
        "Section: decisionContext",
        `Context from available Initiative sources (${sources}). ${context}`,
        "Section: objectives",
        "List decision objectives, one per line.",
        "Section: options",
        "List options for comparison, one per line. Do not recommend a vote.",
        "Section: risks",
        "List risks and unknowns, one per line.",
        "Section: unresolvedQuestions",
        "List unresolved questions, one per line.",
      ].join("\n");
    case "collective_decision":
      return [
        "Section: title",
        `Collective Decision: ${title}`,
        "Section: decisionSummary",
        `Neutral summary of the decision framing for "${title}". Do not invent vote totals.`,
        "Section: approvedActions",
        "List approved actions only when present in authorized context; otherwise leave planning placeholders.",
        "Section: decisionRationale",
        "Explain rationale without fabricating voting results.",
        "Section: decisionRisks",
        "List implementation risks, one per line.",
        "Section: successCriteria",
        "List success criteria, one per line.",
        "Section: implementationPriorities",
        "List implementation priorities, one per line.",
      ].join("\n");
    case "commitment":
      return [
        "Section: title",
        `Implementation Commitments: ${title}`,
        "Section: summary",
        `Commitment package summary from available decision/Initiative data (${sources}).`,
        "Section: description",
        "Describe the first commitment action. Do not invent participant assignees — use Unassigned roles.",
        "Section: suggestedResponsibleRole",
        "Unassigned",
        "Section: suggestedTimeline",
        "Editable planning template — suggest a timeline window without inventing people.",
        "Section: relatedRisks",
        "List related risks, one per line.",
      ].join("\n");
    case "tracking":
      return [
        "Section: title",
        `Implementation Tracking: ${title}`,
        "Section: summary",
        `Tracking plan summary using available commitments/scope (${sources}).`,
        "Section: milestoneTitle",
        "First milestone title from available approved actions or Initiative scope.",
        "Section: description",
        "Describe the milestone. Never invent responsible Participant ids — leave Unassigned.",
        "Section: plannedStartDate",
        "YYYY-MM-DD (editable planning template)",
        "Section: targetDate",
        "YYYY-MM-DD (editable planning template)",
        "Section: notes",
        "Planning notes and evidence gaps. Do not invent assignees.",
      ].join("\n");
    case "official_response":
      return [
        "Section: title",
        `Official Responses: ${title}`,
        "Section: summary",
        `Author package summary. Never fabricate received official statements.`,
        "Section: noResponseNote",
        "If no reply: document outreach factually. Do not invent institutional responses.",
        "Section: subject",
        "Subject line for an Author-recorded response entry (only when real evidence exists).",
        "Section: responseSummary",
        "Author summary of a received response — never invent the official text.",
        "Section: notes",
        "Author notes and verification needs.",
      ].join("\n");
    case "public_impact":
      return [
        "Section: title",
        `Public Impact Report: ${title}`,
        "Section: executive_summary",
        `Author conclusion draft for "${title}" from available Lifecycle sources (${sources}). Missing optional upstream stages are noted, not invented.`,
        "Section: objectives",
        "Summarize intended outcomes from Collective Decision / Initiative scope when present. Do not invent decisions.",
        "Section: official_responses",
        "State only published Official Response facts or explicitly that no package is published / No Official Response was recorded. Never fabricate an official statement.",
        "Section: evidence",
        "List only evidence ids present in the authorized context. Mark gaps as unconfirmed.",
        "Section: lessons_learned",
        "Record uncertainties and unconfirmed impact honestly.",
      ].join("\n");
    case "archive":
      return [
        "Section: finalArchiveTitle",
        `Civic Archive: ${title}`,
        "Section: finalSummary",
        `Final summary of available Lifecycle history for "${title}" (${sources}). Do not rewrite historical source artifacts.`,
        "Section: lessonsLearned",
        "Author lessons learned from available canonical records.",
        "Section: knowledgeContribution",
        "Knowledge contribution for future Initiatives — factual and reflective only.",
      ].join("\n");
    default:
      return [
        "Section: assistant",
        `Suggested ${request.stageLabel} draft outline for "${title}" using ${sources}.`,
        context,
      ].join("\n");
  }
}

function buildEducationalAnswer(
  request: LifecycleAiProviderRequest,
  question: string,
  sources: string,
): string {
  if (!question) {
    return "Ask a specific question about this context or Humanity Union.";
  }

  // Pack 05 — unknown / unconfirmed platform features (prefer uncertainty over invention).
  if (
    /\b(blockchain voting|nft|metaverse|tiktok integration|instagram login|crypto wallet)\b/i.test(
      question,
    ) ||
    (/\b(will you add|upcoming feature|roadmap|future feature|does humanity union support)\b/i.test(
      question,
    ) &&
      /\b(blockchain|nft|metaverse|tiktok|instagram|crypto)\b/i.test(question))
  ) {
    return ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY;
  }

  if (
    /\b(only members?|must be a member|membership (is )?required|members? (are|is|the) only)\b/i.test(
      question,
    ) ||
    (/\bmembers?\b/i.test(question) &&
      /\b(participant|participate|participation)\b/i.test(question))
  ) {
    return [
      `Regarding: ${question}`,
      "",
      "In the current platform model, Participant is the universal foundational actor identity.",
      "Member is an earned or honorary status within Participant — not a prerequisite for ordinary participation.",
      "A signed-in Participant may join Discussions, support Initiatives, and collaborate when invited without Membership.",
      "A polite correction if needed: do not describe Membership as required for basic civic actions.",
    ].join("\n");
  }

  if (/\bready to collaborate\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Ready to Collaborate expresses interest in working with an Initiative Author on that Initiative.",
      "It is Initiative-scoped collaboration interest — not a global friendship request.",
      "After Ready to Collaborate, a collaboration request may be Accepted or Declined; acceptance yields Active Ally status for that Initiative.",
    ].join("\n");
  }

  if (/\b(active ally|active allies|allies)\b/i.test(question)) {
    if (/\b(edit|author workspace|publish)\b/i.test(question)) {
      return [
        `Regarding: ${question}`,
        "",
        "A polite correction: Active Allies collaborate with the Author but do not receive Author Workspace editing controls.",
        "Why: Author Workspace remains the Author's private drafting space; Allies contribute through Discussion, collaboration tools, and accepted Commitments.",
        "Next step: use Messages or Group Chat for coordination, and keep draft edits in Author Workspace.",
      ].join("\n");
    }

    return [
      `Regarding: ${question}`,
      "",
      "An Active Ally is a Participant collaborating with an Initiative Author on civic work.",
      "Why it matters: Allies help through Discussion, collaboration tools, and accepted Commitments — without taking over Author Workspace.",
      "In Humanity Union, Ally status is earned through Ready to Collaborate and invitation, not assumed.",
      "Next practical step: open Workspace or the Initiative to see Ally-related actions that apply to you.",
    ].join("\n");
  }

  if (/\breminders?\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Reminders are next-step or deadline prompts — for example Collaboration Sessions or pending civic actions.",
      "They are distinct from Notifications (platform/Initiative events) and from Messages (communication links).",
      "Reminders never vote, publish, or accept Commitments for anyone. Completed Reminders may move to Archive.",
    ].join("\n");
  }

  if (/\bnotifications?\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Notifications are durable platform and Initiative event alerts — not private chat transcripts.",
      "In the Notification Center: Notifications (events), Messages (unread links into Workspace Messages),",
      "Reminders (next steps), and Archive (completed Notifications and Reminders).",
      "Messages remain in chat history; they are not stored as Notification Archive items.",
    ].join("\n");
  }

  if (/\b(direct )?messages?\b/i.test(question) || /\b(dm|group chat|collaboration channel)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Messages cover Direct Messaging and Initiative communication entry points such as Group Chat / Collaboration Channel.",
      "Private message history is never sent to the Assistant automatically.",
      "Unread communication entries may appear in the Notification Center as links to Workspace Messages — without moving chat history into Notification Archive.",
    ].join("\n");
  }

  if (/\b(lifecycle overview|initiative lifecycle|lifecycle stages|full lifecycle)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "According to the current Initiative Lifecycle, stages advance in this order:",
      "Initiative → Discussion → Collaborative Analysis → Improvement Proposals → Revision → Petition →",
      "Decision Session → Collective Decision → Implementation Commitments → Implementation Tracking →",
      "Official Responses → Public Impact → Civic Archive.",
      "Each published stage creates a public civic record the Author remains responsible for.",
    ].join("\n");
  }

  if (/\bcollaborative analysis\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "According to the current Initiative Lifecycle, Collaborative Analysis synthesizes Discussion into evidence-aware analysis.",
      "Purpose: support, risks, open questions, and suggested improvements grounded in sources.",
      "Author drafts in Author Workspace; Participants read the published Analysis. AI never publishes.",
    ].join("\n");
  }

  if (/\bpetition\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Petition gathers public expressions of support for the revised civic request.",
      "Petition statistics represent public participation on the Humanity Union platform.",
      "They are indicators of civic interest and support, not an official governmental or legally binding vote.",
      "Do not conflate Petition signatures with Collective Decision voting.",
    ].join("\n");
  }

  if (/\bcollective decision\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Collective Decision records WHAT was decided under platform eligibility rules.",
      "It is distinct from Petition signatures and Support signals.",
      "Implementation Commitments later define WHO voluntarily accepts responsibility — the decision itself does not force implementers.",
    ].join("\n");
  }

  if (/\b(implementation )?tracking\b/i.test(question) && !/\bnotification\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Implementation Tracking shows HOW implementation is progressing against accepted Commitments.",
      "Collective Decision defines WHAT; Commitments define WHO; Tracking records progress and blockers with evidence.",
      "AI must not invent completed work that is not in authorized context.",
    ].join("\n");
  }

  if (/\b(implementation )?commitments?\b/i.test(question) || /\b(accept|decline).{0,20}responsibility\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Collective Decision defines WHAT. Implementation Commitments define WHO voluntarily accepts responsibility.",
      "The Author may propose responsibility; a Participant accepts or declines — no forced responsibility.",
      "Focus on deliverable, resources, and timing — not on judging personal worth.",
    ].join("\n");
  }

  if (/\bofficial responses?\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "According to the current Initiative Lifecycle, Official Responses record replies from relevant institutions when they engage.",
      "They become part of the public accountability record. The Assistant must not invent institutional statements.",
    ].join("\n");
  }

  if (/\bpublic impact\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Public Impact should distinguish outcomes that have evidence from claims that are still aspirational.",
      "Popularity or support signals are not proof of impact.",
      "One possible improvement is to cite Tracking evidence for completed work and leave remaining work explicit.",
    ].join("\n");
  }

  if (/\bcivic archive\b/i.test(question) || (/\barchive\b/i.test(question) && /\b(initiative|lifecycle|lesson)/i.test(question))) {
    return [
      `Regarding: ${question}`,
      "",
      "According to the current Initiative Lifecycle, Civic Archive preserves lessons and historical summary of completed Initiative work.",
      "It is knowledge sharing for future Participants — not a place to invent success or hide published facts.",
    ].join("\n");
  }

  if (/\b(support|do not support|representative|non-binding|legally binding)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Support / Do Not Support and Petition signatures are representative participation indicators on Humanity Union.",
      "They reflect civic interest on the platform and are not an official governmental or legally binding vote.",
      "Formal Collective Decision voting is a later, distinct Lifecycle action with its own eligibility rules.",
    ].join("\n");
  }

  if (/\b(privacy|visibility|skills visibility|professional links|location visibility)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "Privacy controls govern what others see on Profile / Participation Area — including skills, professional links,",
      "organization, location, and related presentation choices.",
      "Private messages and credentials are never public civic records and are never sent to AI automatically.",
      "Knowing a privacy policy exists does not authorize exposing private field values.",
    ].join("\n");
  }

  if (/\b(uncertainty|not sure|unknown|missing evidence)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "The available evidence suggests the current sources do not fully establish this point.",
      "This is not established by the current sources alone; there may be competing interpretations.",
      "Next practical step: gather the missing source or mark the claim as an open question before publishing.",
    ].join("\n");
  }

  if (/\b(evidence|fact|opinion|assumption)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "There are a few assumptions here we can test.",
      "Separate what is a fact recorded in sources, what is evidence supporting a conclusion,",
      "what is still an opinion or prediction, and what remains unknown.",
      `For ${request.stageLabel}, rely on: ${sources}.`,
      "What evidence supports this conclusion, and could there be another explanation?",
    ].join("\n");
  }

  if (/\b(decision session|options|risks|how should .* vote)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "For Decision Session, compare options and risks without recommending a vote.",
      "What: lay out each option and who could be affected differently.",
      "Why: Participants decide; the Assistant improves decision quality, not outcomes.",
      "Next step: document unknowns and consequences clearly before the session opens.",
    ].join("\n");
  }

  if (/\b(critical|assumption|change your view|another explanation)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "That concern is worth examining from two sides.",
      "Which assumption matters most here?",
      "What would change your view if new evidence appeared?",
      "Who could be affected differently by this decision?",
    ].join("\n");
  }

  if (/\b(save draft|publish|petition)\b/i.test(question) && /\bwhat\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "What: Save Draft keeps private Author Workspace work; Publish makes a version publicly visible and fixes that version for participation.",
      "Why: publishing starts public consequences (for example Petition endorsement), so wording should still match the final Revision.",
      "Next practical step: check clarity and neutrality, then Preview before Publish.",
    ].join("\n");
  }

  if (/\b(stop creating|have to stop|must i stop|block(s|ed|ing)? creation|prevent(s|ed|ing)? (me from )?creat)\b/i.test(question)) {
    return [
      `Regarding: ${question}`,
      "",
      "No. The platform surfaces related work for awareness and collaboration; it does not automatically block, merge or suppress the Initiative.",
      "You may review related Initiatives, continue creating, or consider collaboration. Creation remains under Author control.",
    ].join("\n");
  }

  if (
    /\b(similar|related|duplicate|duplicat|overlap|collaborat|complementary|already exist|same initiative|other initiative|why am i seeing)\b/i.test(
      question,
    )
  ) {
    const communityBlock = extractCommunityIntelligenceBlock(request.sourceContextSummary);
    if (communityBlock) {
      return [
        `Regarding: ${question}`,
        "",
        "Community Intelligence provides structured relationship signals only — never invent Initiatives beyond that block.",
        "A `possible_duplicate` signal means possible overlap, not a confirmed duplicate. The platform never auto-merges or suppresses Initiatives.",
        "Reasons come from identifiable public signals (for example shared Participation Area or themes), never from opaque model opinion alone.",
        "",
        communityBlock,
      ].join("\n");
    }

    return [
      `Regarding: ${question}`,
      "",
      "No structured Community Intelligence relationships were available for this request.",
      "I will not invent similar Initiatives. Open Related Initiatives on the public Initiative page or ask again from an Initiative context.",
    ].join("\n");
  }

  return [
    `Regarding your question: ${question}`,
    "",
    "In Humanity Union, Lifecycle stages advance civic work publicly.",
    "Use Workspace for Initiatives, Notifications for Lifecycle alerts, and Messages for private conversations (never sent to AI automatically).",
    `For ${request.stageLabel}, rely on: ${sources}.`,
    "If useful, say what you are trying to decide next and we can examine evidence, assumptions, and next steps.",
  ].join("\n");
}

function extractCommunityIntelligenceBlock(sourceContextSummary: string): string | null {
  const marker = "Community Intelligence (structured";
  const start = sourceContextSummary.indexOf(marker);
  if (start < 0) {
    return null;
  }
  return sourceContextSummary.slice(start).trim();
}
