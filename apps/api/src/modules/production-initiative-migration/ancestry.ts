import type { Document } from "mongodb";

import type { AncestryMethod } from "./types.js";

export interface AncestryResolution {
  method: AncestryMethod;
  initiativeId: string | null;
  ambiguous: boolean;
  detail: string;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Resolve Initiative ancestry for a document given a declared method and optional parent maps.
 * Ambiguous MUST ancestry must fail closed at the preflight layer.
 */
export function resolveDocumentAncestry(input: {
  doc: Document;
  method: AncestryMethod;
  allowList: ReadonlySet<string>;
  parentInitiativeById?: ReadonlyMap<string, string | null>;
}): AncestryResolution {
  const { doc, method, allowList, parentInitiativeById } = input;

  if (method === "root" || method === "direct:initiativeId" || method === "pk:initiativeId") {
    const initiativeId = asNonEmptyString(doc.initiativeId) ?? asNonEmptyString(doc._id);
    if (!initiativeId) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: "missing initiativeId",
      };
    }
    return {
      method,
      initiativeId,
      ambiguous: !allowList.has(initiativeId),
      detail: allowList.has(initiativeId) ? "direct" : "outside_allow_list",
    };
  }

  if (method === "direct:subject.initiativeId") {
    const subject =
      doc.subject && typeof doc.subject === "object"
        ? (doc.subject as Record<string, unknown>)
        : null;
    const initiativeId =
      asNonEmptyString(subject?.initiativeId) ?? asNonEmptyString(doc.initiativeId);
    if (!initiativeId) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: "missing subject.initiativeId",
      };
    }
    return {
      method,
      initiativeId,
      ambiguous: !allowList.has(initiativeId),
      detail: allowList.has(initiativeId) ? "subject.direct" : "outside_allow_list",
    };
  }

  if (method === "optional:initiativeId") {
    const initiativeId = asNonEmptyString(doc.initiativeId);
    if (!initiativeId) {
      return {
        method,
        initiativeId: null,
        ambiguous: false,
        detail: "no_initiative_scope",
      };
    }
    return {
      method,
      initiativeId,
      ambiguous: !allowList.has(initiativeId),
      detail: allowList.has(initiativeId) ? "optional.direct" : "outside_allow_list",
    };
  }

  const parentFieldByMethod: Partial<Record<AncestryMethod, string>> = {
    "parent:decisionId": "decisionId",
    "parent:trackingId": "trackingId",
    "parent:impactId": "impactId",
    "parent:petitionId": "petitionId",
    "parent:sessionId": "sessionId",
    "parent:analysisId": "analysisId",
  };

  const parentField = parentFieldByMethod[method];
  if (parentField) {
    const parentId = asNonEmptyString(doc[parentField]);
    if (!parentId) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: `missing ${parentField}`,
      };
    }
    if (!parentInitiativeById) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: `parent map unavailable for ${parentField}`,
      };
    }
    if (!parentInitiativeById.has(parentId)) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: `parent ${parentField}=${parentId} not found`,
      };
    }
    const initiativeId = parentInitiativeById.get(parentId) ?? null;
    if (!initiativeId) {
      return {
        method,
        initiativeId: null,
        ambiguous: true,
        detail: `parent ${parentField}=${parentId} has no initiativeId`,
      };
    }
    return {
      method,
      initiativeId,
      ambiguous: !allowList.has(initiativeId),
      detail: allowList.has(initiativeId) ? `via ${parentField}` : "outside_allow_list",
    };
  }

  if (method === "participant-scoped" || method === "none") {
    return {
      method,
      initiativeId: null,
      ambiguous: false,
      detail: method,
    };
  }

  return {
    method: "ambiguous",
    initiativeId: null,
    ambiguous: true,
    detail: "unresolved ancestry method",
  };
}

export function assertAmbiguousMustFails(
  classification: string,
  ambiguousCount: number,
): boolean {
  return classification === "MUST_MIGRATE" && ambiguousCount > 0;
}
