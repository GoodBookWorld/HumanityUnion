import type { PlatformKnowledgeModule } from "../types.js";

/**
 * Author Access Pack 04 — Blog / Author capability Platform Knowledge.
 * Educational only: Assistant must never approve applications, grant
 * capability, publish content, or override Editor/Admin review.
 */
export const BLOG_AUTHORING_MODULES: readonly PlatformKnowledgeModule[] = [
  {
    moduleId: "blog_publishing",
    category: "blog",
    label: "Humanity Union Blog",
    topicLabel: "Blog",
    keywords: [
      "blog",
      "publication",
      "publications",
      "authoring",
      "conscious existence",
      "human security",
      "our life",
      "publishing",
    ],
    surfaces: ["blog", "workspace", "archive"],
    relatedModuleIds: ["blog_author_access", "assistant_capabilities"],
    content: [
      "The Humanity Union Blog is the Publishing Domain for authored publications and perspectives.",
      "It is not the Knowledge Center: Knowledge holds structured educational resources; Blog holds authored publications.",
      "Public Blog routes are /blog and /blog/{slug}. Workspace Authoring is /workspace/authoring.",
      "Current publication categories: Conscious Existence (reflection, knowledge, awareness, education, human development);",
      "Human Security (safety, rights, peace, institutions, public risks, protection, social stability);",
      "Our Life (everyday life, communities, relationships, culture, environment, personal and collective experience).",
      "Category guidance is editorial orientation, not rigid censorship.",
      "Publishing workflow for Authors: draft → submit for review → Editor/Admin publish (Trusted Authors may publish accepted content directly unless Safety requires review).",
      "Safety cannot be bypassed. The Assistant never publishes, approves, or grants Author rights.",
    ].join(" "),
  },
  {
    moduleId: "blog_author_access",
    category: "blog",
    label: "Blog Author Access",
    topicLabel: "Become an Author",
    keywords: [
      "become an author",
      "author application",
      "blog author",
      "trusted author",
      "editor",
      "administrator",
      "author applicant",
      "under review",
      "publishing permissions",
      "how can i become",
      "write about",
    ],
    surfaces: ["blog", "workspace"],
    relatedModuleIds: ["blog_publishing", "participant_member", "assistant_capabilities"],
    content: [
      "Author is a capability of Participant — not a separate identity.",
      "Capability chain: Participant → Author Applicant → Author → Trusted Author → Editor → Administrator.",
      "To become a Blog Author, a signed-in Participant opens Workspace → Become an Author (/workspace/authoring),",
      "reads the welcome guidance, selects preferred categories (interest only), and submits a short application",
      "(motivation, topics, optional previous writing link, agreement to Safety and publishing standards).",
      "Application statuses: submitted, under_review, changes_requested, approved, declined.",
      "Duplicate active applications are blocked. Participant identity is always resolved server-side from the session.",
      "Approved applications grant the Author capability and show a Publishing-ready Workspace state.",
      "Trusted Authors may publish their own accepted content directly unless Safety requires review.",
      "Editors and Administrators will use a future Administration/Editorial surface for review tools;",
      "capability resolution already applies. The Assistant must never approve an application, grant capability,",
      "publish content, or override Editor/Admin review.",
    ].join(" "),
  },
];
