import type {
  AdminMemberBadgeFulfillmentUpdateInput,
  AdminMemberBadgeLabelEmailResult,
  AdminMemberBadgeOrderDetail,
} from "@hu/types";

import { API_BASE_URL, ApiRequestError, apiRequest } from "../../lib/api-client";

function adminMemberBadgeOrderPath(applicationId: string, suffix = ""): string {
  return `/api/v1/admin/member-badge-applications/${encodeURIComponent(applicationId)}${suffix}`;
}

export async function fetchAdminMemberBadgeOrder(
  applicationId: string,
): Promise<AdminMemberBadgeOrderDetail> {
  return apiRequest<AdminMemberBadgeOrderDetail>(adminMemberBadgeOrderPath(applicationId));
}

export async function patchAdminMemberBadgeFulfillment(
  applicationId: string,
  input: AdminMemberBadgeFulfillmentUpdateInput,
): Promise<AdminMemberBadgeOrderDetail> {
  return apiRequest<AdminMemberBadgeOrderDetail>(
    adminMemberBadgeOrderPath(applicationId, "/fulfillment"),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function emailAdminMemberBadgeLabel(
  applicationId: string,
): Promise<AdminMemberBadgeLabelEmailResult> {
  return apiRequest<AdminMemberBadgeLabelEmailResult>(
    adminMemberBadgeOrderPath(applicationId, "/email-label"),
    {
      method: "POST",
    },
  );
}

/** Absolute path for the A5 label PDF (authorized fetch required). */
export function adminMemberBadgeLabelPdfPath(applicationId: string): string {
  return adminMemberBadgeOrderPath(applicationId, "/label.pdf");
}

/**
 * Fetch the A5 shipping-label PDF with Admin cookie credentials and open a
 * print-focused window. Never exposes Stripe secrets.
 */
export async function printAdminMemberBadgeLabel(applicationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${adminMemberBadgeLabelPdfPath(applicationId)}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Unable to load the shipping label for printing.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiRequestError(message, response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const printWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");

  if (!printWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new ApiRequestError(
      "Pop-up blocked. Allow pop-ups to print the shipping label.",
      0,
    );
  }

  const revokeLater = () => {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  printWindow.addEventListener("load", () => {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      revokeLater();
    }
  });

  // Fallback if load already fired (PDF viewers vary).
  window.setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // viewer may not support scripted print
    }
    revokeLater();
  }, 750);
}
