import { NO_DATA_LABEL, type SearchTrendPoint } from "../admin-seo-search-performance-model";

interface SearchPerformanceTrendChartProps {
  title: string;
  points: readonly SearchTrendPoint[];
  color: string;
  emptyMessage: string;
}

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
 * Single-series daily trend using the Insights chart styles. Days without a
 * provider value break the line and read "No data" in the table; they are never
 * drawn as zero.
 */
export function SearchPerformanceTrendChart({
  title,
  points,
  color,
  emptyMessage,
}: SearchPerformanceTrendChartProps) {
  if (!points.some((point) => point.value !== null)) {
    return <p className="hu-caption">{emptyMessage}</p>;
  }

  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxValue = niceMax(Math.max(...points.map((point) => point.value ?? 0), 0));
  const xFor = (index: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yFor = (value: number) => pad.top + innerH - (value / maxValue) * innerH;
  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  const segments: string[] = [];
  const isolated: number[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length === 1) {
        isolated.push(index - 1);
      }
      if (current.length > 1) {
        segments.push(current.join(" "));
      }
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? "M" : "L"}${xFor(index)} ${yFor(point.value)}`);
  });
  if (current.length === 1) {
    isolated.push(points.length - 1);
  } else if (current.length > 1) {
    segments.push(current.join(" "));
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div className="admin-insights-chart">
      <svg
        className="admin-insights-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} by day, ${first.label} to ${last.label}. Gaps are days without data.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = pad.top + innerH * (1 - fraction);
          return (
            <g key={fraction}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y}
                y2={y}
                className="admin-insights-chart__grid"
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="admin-insights-chart__tick"
              >
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          );
        })}
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke={color} strokeWidth={2} />
        ))}
        {isolated.map((index) => (
          <circle
            key={index}
            cx={xFor(index)}
            cy={yFor(points[index]!.value ?? 0)}
            r={3}
            fill={color}
          />
        ))}
        {points.map((point, index) =>
          index % labelStep === 0 || index === points.length - 1 ? (
            <text
              key={point.day}
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
          <caption className="hu-visually-hidden">{title} by day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <td>{point.label}</td>
                <td>{point.value === null ? NO_DATA_LABEL : point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
