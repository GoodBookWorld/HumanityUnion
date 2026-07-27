import { ApproximateIpGeographicNavigator } from "./ApproximateIpGeographicNavigator";
import { InteractiveWorldMap } from "../../world-map/components/InteractiveWorldMap";

import "./public-home-geographic-navigation.css";

export function PublicHomeGeographicNavigationSection() {
  return (
    <section
      className="public-home-v2__section public-home-v2__geographic-navigation"
      aria-labelledby="public-home-geographic-navigation-title"
    >
      <h2 id="public-home-geographic-navigation-title">Explore civic activity by place</h2>
      <p className="public-home-v2__section-intro">
        Navigate from world scope to countries, regions, and communities. Country pages open civic
        activity for the selected place; deeper filters open in Search.
      </p>
      <ApproximateIpGeographicNavigator />
      <div className="public-home-v2__world-map">
        <InteractiveWorldMap />
      </div>
    </section>
  );
}
