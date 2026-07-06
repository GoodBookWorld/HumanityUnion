import { getReviewById } from "../modules/civic-compatibility-review/civic-compatibility-review.store.js";

const reviewId = process.argv[2];
const expectedReviewVersion = process.argv[3] ? Number.parseInt(process.argv[3], 10) : undefined;
const expectedInitiativeVersion = process.argv[4]
  ? Number.parseInt(process.argv[4], 10)
  : undefined;

if (!reviewId) {
  process.exit(1);
}

const review = getReviewById(reviewId);

if (!review) {
  process.exit(1);
}

if (
  expectedReviewVersion !== undefined &&
  Number.isFinite(expectedReviewVersion) &&
  review.reviewVersion !== expectedReviewVersion
) {
  process.exit(1);
}

if (
  expectedInitiativeVersion !== undefined &&
  Number.isFinite(expectedInitiativeVersion) &&
  review.initiativeVersion !== expectedInitiativeVersion
) {
  process.exit(1);
}
