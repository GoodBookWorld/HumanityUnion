import type { ReactNode } from "react";

export interface AdminMetricDetailCell {
  readonly label: string;
  readonly value: ReactNode;
  /** Optional caption under the value (e.g. measurement window). */
  readonly caption?: string;
  /** Marks the cell as a methodological parameter, not a count. */
  readonly methodological?: boolean;
}

interface AdminMetricDetailsGridProps {
  cells: readonly AdminMetricDetailCell[];
  "aria-label"?: string;
}

/**
 * Admin detail grid with alternating subtle backgrounds.
 * Column count follows the number of cells (Pack 25D.1 — five Participant aggregates).
 * Stacks on small screens while preserving order.
 */
export function AdminMetricDetailsGrid({
  cells,
  "aria-label": ariaLabel,
}: AdminMetricDetailsGridProps) {
  const columnClass =
    cells.length === 5
      ? "admin-metric-details-grid admin-metric-details-grid--cols-5"
      : "admin-metric-details-grid";

  return (
    <ul className={columnClass} aria-label={ariaLabel}>
      {cells.map((cell, index) => (
        <li
          key={cell.label}
          className={
            index % 2 === 0
              ? "admin-metric-details-grid__cell"
              : "admin-metric-details-grid__cell admin-metric-details-grid__cell--alt"
          }
        >
          <p className="admin-metric-details-grid__label">{cell.label}</p>
          <p
            className={
              cell.methodological
                ? "admin-metric-details-grid__value admin-metric-details-grid__value--method"
                : "admin-metric-details-grid__value"
            }
          >
            {cell.value}
          </p>
          {cell.caption ? (
            <p className="admin-metric-details-grid__caption">{cell.caption}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
