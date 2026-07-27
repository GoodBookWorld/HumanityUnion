import { PUBLIC_HOME_CORE_VALUES } from "../constants";

import "./public-home-geographic-navigation.css";

export function PublicHomeCoreValuesSection() {
  return (
    <section
      className="public-home-v2__section public-home-v2__core-values"
      aria-labelledby="public-home-core-values-title"
    >
      <h2 id="public-home-core-values-title" className="public-home-v2__visually-hidden">
        Core values
      </h2>
      <ul className="public-home-v2__values-grid">
        {PUBLIC_HOME_CORE_VALUES.map((value) => (
          <li key={value.id} className="public-home-v2__value-item">
            <img
              className="public-home-v2__value-icon"
              src={value.iconSrc}
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
            />
            <p className="public-home-v2__value-word">{value.word}</p>
            <p className="public-home-v2__value-hint">{value.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
