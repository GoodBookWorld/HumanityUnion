import { countEvidenceForImpact } from "../modules/initiative-public-impact/initiative-public-impact.store.js";

const impactId = process.argv[2];
const expectedCount = Number(process.argv[3]);

if (!impactId || Number.isNaN(expectedCount)) {
  process.exit(1);
}

if (countEvidenceForImpact(impactId) !== expectedCount) {
  process.exit(1);
}
