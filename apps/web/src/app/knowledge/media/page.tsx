import { permanentRedirect } from "next/navigation";

export default function LegacyKnowledgeMediaRedirectPage() {
  permanentRedirect("/media");
}
