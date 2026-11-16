import Image from "next/image";

type RegionalProgramIconProps = {
  readonly src: string;
  readonly className?: string;
  /** Display box size in px. Aspect ratio is preserved via object-fit. */
  readonly size?: number;
};

/** Decorative icon (accessible name comes from adjacent text). */
export function RegionalProgramIcon({
  src,
  className,
  size = 28,
}: RegionalProgramIconProps) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      unoptimized
      aria-hidden="true"
    />
  );
}
