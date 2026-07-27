import { Card } from "../../../design-system";
import { PUBLIC_HOME_WORLD_MAP_PLACEHOLDER } from "../constants";

export function PublicHomeWorldMapPlaceholderSection() {
  return (
    <section
      className="public-home-v2__section public-home-v2__map-placeholder"
      aria-labelledby="public-home-map-title"
    >
      <Card className="public-home-v2__card public-home-v2__map-card">
        <h2 id="public-home-map-title">{PUBLIC_HOME_WORLD_MAP_PLACEHOLDER.title}</h2>
        <p>{PUBLIC_HOME_WORLD_MAP_PLACEHOLDER.description}</p>
        <div className="public-home-v2__map-frame" aria-hidden="true" />
      </Card>
    </section>
  );
}
