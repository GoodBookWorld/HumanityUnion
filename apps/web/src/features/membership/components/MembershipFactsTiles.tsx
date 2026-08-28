export type MembershipFactTone =
  | "pale-blue"
  | "pale-amber"
  | "pale-green"
  | "pale-violet"
  | "pale-cyan";

export interface MembershipFactTile {
  id: string;
  label: string;
  value: string;
  tone: MembershipFactTone;
}

interface MembershipFactsTilesProps {
  tiles: readonly MembershipFactTile[];
  ariaLabel?: string;
  className?: string;
}

/**
 * Pack 25D — equal-width multicolor Membership fact tiles.
 * Visible tiles redistribute across the row; empty tiles are never rendered.
 */
export function MembershipFactsTiles({
  tiles,
  ariaLabel = "Membership facts",
  className,
}: MembershipFactsTilesProps) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <dl
      className={["membership-facts-tiles", className].filter(Boolean).join(" ")}
      style={{ ["--membership-facts-count" as string]: String(tiles.length) }}
      aria-label={ariaLabel}
    >
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className={`membership-facts-tiles__tile membership-facts-tiles__tile--${tile.tone}`}
        >
          <dt>{tile.label}</dt>
          <dd>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
