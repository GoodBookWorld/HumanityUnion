import type { TrafficTrendPoint } from "@hu/types";

interface TrafficInsightsTrendChartProps {
  points: readonly TrafficTrendPoint[];
  emptyMessage: string;
}

const SERIES = [
  { key: "views" as const, label: "Views", color: "var(--hu-color-primary, #0174b0)" },
  {
    key: "visitors" as const,
    label: "Daily unique visitors",
    color: "var(--hu-color-accent, #df9815)",
  },
  { key: "sessions" as const, label: "Sessions", color: "var(--hu-workspace-text-muted, #4a5d6a)" },
];

function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Lightweight accessible multi-series line chart (no chart library dependency).
 */
export function TrafficInsightsTrendChart({ points, emptyMessage }: TrafficInsightsTrendChartProps) {
  if (points.length === 0) {
    return <p className="hu-caption">{emptyMessage}</p>;
  }

  const width = 720;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxValue = niceMax(
    Math.max(...points.flatMap((point) => [point.views, point.visitors, point.sessions]), 0),
  );

  const xFor = (index: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yFor = (value: number) => pad.top + innerH - (value / maxValue) * innerH;

  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="admin-insights-chart">
      <ul className="admin-insights-chart__legend" aria-label="Series legend">
        {SERIES.map((series) => (
          <li key={series.key}>
            <span
              className="admin-insights-chart__swatch"
              style={{ background: series.color }}
              aria-hidden="true"
            />
            {series.label}
          </li>
        ))}
      </ul>

      <svg
        className="admin-insights-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Historical trends for Views, Daily unique visitors, and Sessions"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = pad.top + innerH * (1 - fraction);
          const tick = Math.round(maxValue * fraction);
          return (
            <g key={fraction}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y}
                y2={y}
                className="admin-insights-chart__grid"
              />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="admin-insights-chart__tick">
                {tick}
              </text>
            </g>
          );
        })}

        {SERIES.map((series) => {
          const path = points
            .map((point, index) => {
              const x = xFor(index);
              const y = yFor(point[series.key]);
              return `${index === 0 ? "M" : "L"}${x} ${y}`;
            })
            .join(" ");
          return (
            <path
              key={series.key}
              d={path}
              fill="none"
              stroke={series.color}
              strokeWidth={2}
              strokeDasharray={series.key === "sessions" ? "5 4" : undefined}
            />
          );
        })}

        {points.map((point, index) =>
          index % labelStep === 0 || index === points.length - 1 ? (
            <text
              key={point.bucket}
              x={xFor(index)}
              y={height - 10}
              textAnchor="middle"
              className="admin-insights-chart__tick"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      <div className="admin-insights-chart__table-wrap">
        <table className="admin-traffic__table">
          <caption className="hu-visually-hidden">
            Historical trend data table for Views, Daily unique visitors, and Sessions
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Views</th>
              <th scope="col">Daily unique visitors</th>
              <th scope="col">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.bucket}>
                <td>{point.label}</td>
                <td>{point.views}</td>
                <td>{point.visitors}</td>
                <td>{point.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
