/**
 * Pack 2.1 — locale-prefixed public initiative; delegates to canonical page.
 * Pack 2.1B — force-dynamic so locale variants cannot reuse a cached English render.
 */
import CanonicalPage, {
  generateMetadata as canonicalGenerateMetadata,
} from "../../../../initiatives/public/[initiativeId]/page";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; initiativeId: string }>;
};

export async function generateMetadata(props: Props) {
  const { initiativeId } = await props.params;
  return canonicalGenerateMetadata({
    params: Promise.resolve({ initiativeId }),
  });
}

export default async function LocalePrefixedPublicInitiativePage(props: Props) {
  const { initiativeId } = await props.params;
  return <CanonicalPage params={Promise.resolve({ initiativeId })} />;
}
