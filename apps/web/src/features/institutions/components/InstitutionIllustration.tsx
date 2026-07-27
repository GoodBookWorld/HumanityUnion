const INSTITUTION_IMAGE_SOURCES: Record<string, string> = {
  "humanity-council": "/images/institutions/humanity-council.webp",
  "state-representatives": "/images/institutions/chamber-state.webp",
  "intellectual-analysis": "/images/institutions/chamber-ia.webp",
  "expert-analysis-team": "/images/institutions/expert-analysis.webp",
  "state-collaboration": "/images/institutions/state-collaboration.webp",
  secretariat: "/images/institutions/secretariat.webp",
  hpc: "/images/institutions/protection-center.webp",
  wpc: "/images/institutions/wpc.webp",
  "community-units": "/images/institutions/csd.webp",
  "regional-offices": "/images/institutions/regional-org.webp",
};

const HERO_IMAGE_SOURCES: Record<string, string> = {
  hpc: "/images/institutions/hpc.webp",
  wpc: "/images/institutions/wpc.webp",
};

interface InstitutionIllustrationProps {
  illustrationId: string;
  title: string;
  variant?: "card" | "hero";
  decorative?: boolean;
}

function resolveImageSrc(illustrationId: string, variant: "card" | "hero"): string {
  if (variant === "hero" && HERO_IMAGE_SOURCES[illustrationId]) {
    return HERO_IMAGE_SOURCES[illustrationId];
  }

  return INSTITUTION_IMAGE_SOURCES[illustrationId] ?? `/images/institutions/${illustrationId}.webp`;
}

export function InstitutionIllustration({
  illustrationId,
  title,
  variant = "card",
  decorative = false,
}: InstitutionIllustrationProps) {
  const src = resolveImageSrc(illustrationId, variant);

  return (
    <div className="institutions-illustration">
      <img
        className="institutions-illustration__image"
        src={src}
        alt={decorative ? "" : `Illustration for ${title}`}
        aria-hidden={decorative ? true : undefined}
        width={640}
        height={360}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 768px) 100vw, (max-width: 1279px) 50vw, 33vw"
      />
    </div>
  );
}

export function InstitutionHeroIllustration({
  illustrationId,
  title,
  subtitle,
}: {
  illustrationId: string;
  title: string;
  subtitle: string;
}) {
  const src = resolveImageSrc(illustrationId, "hero");

  return (
    <div className="institutions-hero-illustration">
      <img
        className="institutions-hero-illustration__image"
        src={src}
        alt=""
        aria-hidden="true"
        width={960}
        height={540}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 768px) 100vw, 960px"
      />
      <div className="institutions-hero-illustration__overlay">
        <h3 className="institutions-hero-illustration__title">{title}</h3>
        <p className="institutions-hero-illustration__subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
