import { PUBLIC_HOME_HUMANITY_AI_PRINCIPLE } from "../constants";

/**
 * Branded Humanity AI principle — sits below the Hero, above the next-section divider.
 * Always server-rendered; CSS hides on mobile while keeping DOM text for SEO.
 */
export function PublicHomeHumanityAiPrinciple() {
  return (
    <p className="public-home-v2__humanity-ai-principle">{PUBLIC_HOME_HUMANITY_AI_PRINCIPLE}</p>
  );
}
