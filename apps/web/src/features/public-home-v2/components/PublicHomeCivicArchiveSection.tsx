import {
  PublicHomeResourceActions,
  PublicHomeResourcePrimaryButton,
  PublicHomeResourceSection,
} from "./PublicHomeResourceSection";

export function PublicHomeCivicArchiveSection() {
  return (
    <PublicHomeResourceSection
      id="public-home-archive-title"
      title="Civic Archive"
      intro="Preserve civic knowledge, achievements, and lessons for future generations."
      backgroundImage="/images/media/all-archives.webp"
      toneClass="archive"
    >
      <p className="public-home-v2__resource-copy">
        Preserving civic knowledge, achievements, and lessons for future generations.
      </p>
      <PublicHomeResourceActions>
        <PublicHomeResourcePrimaryButton href="/civic-archive">
          Explore Civic Archive
        </PublicHomeResourcePrimaryButton>
      </PublicHomeResourceActions>
    </PublicHomeResourceSection>
  );
}
