import {
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
} from "./constants.js";

export type CategoryCanonicalFields = {
  categoryId: string;
  slug: string;
  name: string;
  status: string;
  sortOrder?: number;
};

export type CategoryClassification =
  | "EQUIVALENT"
  | "EQUIVALENT_SORT_ORDER_DIFFERS"
  | "DIVERGENT"
  | "INSERT"
  | "DESTINATION_ID_COLLISION"
  | "DESTINATION_SLUG_COLLISION"
  | "SOURCE_MISSING"
  | "UNEXPECTED";

export function classifySeedCategoryPair(input: {
  source: CategoryCanonicalFields | null;
  destination: CategoryCanonicalFields | null;
}): {
  classification: CategoryClassification;
  sortOrderDiffers: boolean;
  divergentFields: string[];
} {
  if (!input.source) {
    return {
      classification: "SOURCE_MISSING",
      sortOrderDiffers: false,
      divergentFields: [],
    };
  }
  if (!input.destination) {
    return {
      classification: "UNEXPECTED",
      sortOrderDiffers: false,
      divergentFields: ["destinationAbsent"],
    };
  }

  const divergentFields: string[] = [];
  if (input.source.slug !== input.destination.slug) divergentFields.push("slug");
  if (input.source.name !== input.destination.name) divergentFields.push("name");
  if (input.source.status !== input.destination.status) divergentFields.push("status");

  const sortOrderDiffers =
    Number(input.source.sortOrder) !== Number(input.destination.sortOrder);

  if (divergentFields.length > 0) {
    return { classification: "DIVERGENT", sortOrderDiffers, divergentFields };
  }
  if (sortOrderDiffers) {
    return {
      classification: "EQUIVALENT_SORT_ORDER_DIFFERS",
      sortOrderDiffers: true,
      divergentFields: [],
    };
  }
  return { classification: "EQUIVALENT", sortOrderDiffers: false, divergentFields: [] };
}

export function classifyHumanPotentialCategory(input: {
  source: CategoryCanonicalFields | null;
  destinationById: CategoryCanonicalFields | null;
  destinationBySlug: CategoryCanonicalFields | null;
}): {
  classification: CategoryClassification;
  sourceMetadata: CategoryCanonicalFields | null;
} {
  if (!input.source || input.source.categoryId !== EXPECTED_INSERT_CATEGORY_ID) {
    return { classification: "SOURCE_MISSING", sourceMetadata: input.source };
  }
  if (input.destinationById) {
    return {
      classification: "DESTINATION_ID_COLLISION",
      sourceMetadata: input.source,
    };
  }
  if (
    input.destinationBySlug &&
    input.destinationBySlug.categoryId !== EXPECTED_INSERT_CATEGORY_ID
  ) {
    return {
      classification: "DESTINATION_SLUG_COLLISION",
      sourceMetadata: input.source,
    };
  }
  return { classification: "INSERT", sourceMetadata: input.source };
}

export function isExpectedSeedCategoryId(categoryId: string): boolean {
  return (EXPECTED_SEED_CATEGORY_IDS as readonly string[]).includes(categoryId);
}
