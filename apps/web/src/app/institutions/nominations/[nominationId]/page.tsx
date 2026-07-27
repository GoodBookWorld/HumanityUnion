import Link from "next/link";

import { FullNominationPosterPageContent } from "../../../../features/civic-nomination/components/FullNominationPosterPageContent";
import { getPublicCivicNomination } from "../../../../features/civic-nomination/api";

interface CivicNominationPosterPageProps {
  params: Promise<{
    nominationId: string;
  }>;
}

export default async function CivicNominationPosterPage({
  params,
}: CivicNominationPosterPageProps) {
  const { nominationId } = await params;
  const nomination = await getPublicCivicNomination(nominationId);

  if (!nomination) {
    return (
      <main className="civic-nomination-poster-page">
        <h1>Civic nomination not available</h1>
        <p>This nomination is not published or could not be found.</p>
        <p>
          <Link href="/institutions">Back to Institutions</Link>
        </p>
      </main>
    );
  }

  return <FullNominationPosterPageContent nomination={nomination} />;
}
