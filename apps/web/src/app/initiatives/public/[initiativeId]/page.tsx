import type { Metadata } from "next";

import { CanonicalInitiativeExperienceLoader } from "../../../../features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader";
import { getPublicInitiative } from "../../../../features/initiatives/api";
import { resolveMediaUrl } from "../../../../features/media-upload/media-url";

export const dynamic = "force-dynamic";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

function resolveSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "";
}

function toAbsoluteUrl(pathOrUrl: string, origin: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (!origin) {
    return pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  }
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

/**
 * Social preview metadata for the canonical public Initiative URL.
 * Petition deep-links (`#petition`) share this page's Open Graph tags.
 */
export async function generateMetadata({
  params,
}: PublicInitiativePageProps): Promise<Metadata> {
  const { initiativeId } = await params;
  const origin = resolveSiteOrigin();
  const canonicalPath = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  const canonicalUrl = toAbsoluteUrl(canonicalPath, origin);

  try {
    const initiative = await getPublicInitiative(initiativeId);
    const rawImage =
      initiative.metadata.imageUrl ??
      initiative.metadata.coverMedia?.thumbnailUrl ??
      initiative.metadata.coverMedia?.url ??
      undefined;
    const resolvedImage = resolveMediaUrl(rawImage);
    const absoluteImage = resolvedImage
      ? toAbsoluteUrl(resolvedImage, origin || process.env.NEXT_PUBLIC_API_BASE_URL || "")
      : undefined;
    const description =
      initiative.description.trim().slice(0, 200) ||
      `${initiative.title} on Humanity Union`;

    return {
      title: `${initiative.title} | Humanity Union`,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: initiative.title,
        description,
        url: canonicalUrl,
        type: "website",
        ...(absoluteImage
          ? {
              images: [
                {
                  url: absoluteImage,
                  alt: initiative.metadata.imageAltText || initiative.title,
                },
              ],
            }
          : {}),
      },
      twitter: {
        card: absoluteImage ? "summary_large_image" : "summary",
        title: initiative.title,
        description,
        ...(absoluteImage ? { images: [absoluteImage] } : {}),
      },
    };
  } catch {
    return {
      title: "Initiative | Humanity Union",
      description: "Public Initiative on Humanity Union",
      alternates: { canonical: canonicalPath },
      openGraph: {
        title: "Initiative | Humanity Union",
        url: canonicalUrl,
        type: "website",
      },
    };
  }
}

/**
 * Canonical Initiative experience. Client-loads with credentials so
 * viewerIsSteward / Manage / Author Mode match the authenticated session
 * for both Workspace and Header entry paths.
 */
export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;

  return <CanonicalInitiativeExperienceLoader initiativeId={initiativeId} />;
}
