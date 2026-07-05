import Link from "next/link";

export function GeographicNavigator() {
  return (
    <nav className="geographic-navigator" aria-label="Geographic scope">
      <div className="geographic-navigator__inner">
        <p className="geographic-navigator__label" id="geographic-scope-label">
          Scope
        </p>
        <ol className="geographic-navigator__list" aria-labelledby="geographic-scope-label">
          <li>
            <span
              className="geographic-navigator__scope geographic-navigator__scope--active"
              aria-current="location"
            >
              World
            </span>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href="/country/canada"
            >
              Canada
            </Link>
          </li>
          <li>
            <Link
              className="geographic-navigator__scope geographic-navigator__scope--link"
              href="/region/british-columbia"
            >
              British Columbia
            </Link>
          </li>
        </ol>
      </div>
    </nav>
  );
}
