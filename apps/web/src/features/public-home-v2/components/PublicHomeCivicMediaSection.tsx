import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import {
  PublicHomeResourceActions,
  PublicHomeResourcePrimaryButton,
  PublicHomeResourceSecondaryButton,
  PublicHomeResourceSection,
} from "./PublicHomeResourceSection";

export function PublicHomeCivicMediaSection() {
  return (
    <PublicHomeResourceSection
      id="public-home-civic-media-title"
      title="Civic Media"
      intro="Navigate trustworthy information and turn verified concerns into civic action."
      backgroundImage="/images/media/all-media.webp"
      toneClass="media"
    >
      <p className="public-home-v2__resource-copy">
        Understand the news. Verify the facts. Turn public issues into civic action.
      </p>
      <PublicHomeResourceActions>
        <PublicHomeResourcePrimaryButton href={CIVIC_MEDIA_ROUTE}>
          Explore Civic Media
        </PublicHomeResourcePrimaryButton>
        <PublicHomeResourceSecondaryButton href="/initiatives">
          Create Initiative from a public concern
        </PublicHomeResourceSecondaryButton>
      </PublicHomeResourceActions>
    </PublicHomeResourceSection>
  );
}
