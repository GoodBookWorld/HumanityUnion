/**
 * Pack 2.1 — locale-prefixed public initiative; delegates to canonical page.
 */
import CanonicalPage, {
  generateMetadata as canonicalGenerateMetadata,
} from "../../../../initiatives/public/[initiativeId]/page";

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
