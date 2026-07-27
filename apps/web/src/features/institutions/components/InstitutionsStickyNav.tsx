import { INSTITUTIONS_STICKY_NAV_ITEMS } from "../constants";

export function InstitutionsStickyNav() {
  return (
    <nav className="institutions-sticky-nav" aria-label="Institutions page sections">
      <div className="institutions-sticky-nav__inner">
        <ul className="institutions-sticky-nav__list">
          {INSTITUTIONS_STICKY_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <a href={`#${item.targetId}`} className="institutions-sticky-nav__link">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
