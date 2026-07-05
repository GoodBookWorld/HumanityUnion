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
            <span
              className="geographic-navigator__scope geographic-navigator__scope--disabled"
              aria-disabled="true"
              title="Country Experience is not yet available"
            >
              Country
              <span className="geographic-navigator__scope-note"> (coming soon)</span>
            </span>
          </li>
          <li>
            <span
              className="geographic-navigator__scope geographic-navigator__scope--disabled"
              aria-disabled="true"
              title="Region Experience is not yet available"
            >
              Region
              <span className="geographic-navigator__scope-note"> (coming soon)</span>
            </span>
          </li>
        </ol>
      </div>
    </nav>
  );
}
