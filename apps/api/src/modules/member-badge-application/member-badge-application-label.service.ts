import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import type {
  AdminMemberBadgeLabelEmailResult,
  MemberBadgeApplicationRecord,
} from "@hu/types";

import { sendTransactionalEmail } from "../email/email.service.js";
import {
  MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT,
  MEMBER_BADGE_APPLICATION_SENDER,
} from "./member-badge-application.constants.js";
import { MemberBadgeApplicationValidationError } from "./member-badge-application.errors.js";
import { formatMemberBadgeApplicationAddressLines } from "./member-badge-application.projection.js";

function resolveWebOrigin(): string {
  return (
    process.env.WEB_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000"
  );
}

/** Safe Admin deep-link for QR — never encodes address, phone, or Stripe ids. */
export function resolveMemberBadgeApplicationLookupUrl(applicationId: string): string {
  const origin = resolveWebOrigin().replace(/\/$/, "");
  return `${origin}/admin/participants?view=member_badge_orders&badgeApplicationId=${encodeURIComponent(applicationId)}`;
}

export async function generateLabelQrDataUrl(applicationId: string): Promise<string> {
  const lookupUrl = resolveMemberBadgeApplicationLookupUrl(applicationId);
  return QRCode.toDataURL(lookupUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
    type: "image/png",
  });
}

/** Pack 25D.1 — A5 label layout geometry (points). Exported for focused tests. */
export const MEMBER_BADGE_LABEL_LAYOUT = {
  margin: 36,
  qrSize: 92,
  /** Left column ends near page midpoint (FROM + secondary metadata). */
  leftColumnMaxXRatio: 0.48,
  /** Right column starts just past midpoint (QR + TO). */
  rightColumnXRatio: 0.5,
} as const;

/**
 * Pack 25D.1 A5 composition:
 * - TOP LEFT: FROM (sender)
 * - TOP RIGHT: QR (within safe margins)
 * - RIGHT: TO / recipient (primary delivery destination)
 * - LOWER LEFT: secondary Member # / Application metadata
 */
export async function generateLabelPdfBuffer(
  application: MemberBadgeApplicationRecord,
): Promise<Buffer> {
  const qrDataUrl = await generateLabelQrDataUrl(application.applicationId);
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");
  const recipientLines = formatMemberBadgeApplicationAddressLines(application.shippingAddress);

  return new Promise((resolve, reject) => {
    const pageWidth = MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT[0];
    const pageHeight = MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT[1];
    const margin = MEMBER_BADGE_LABEL_LAYOUT.margin;
    const qrSize = MEMBER_BADGE_LABEL_LAYOUT.qrSize;
    const leftMaxWidth = pageWidth * MEMBER_BADGE_LABEL_LAYOUT.leftColumnMaxXRatio - margin;
    const rightX = pageWidth * MEMBER_BADGE_LABEL_LAYOUT.rightColumnXRatio;
    const rightWidth = pageWidth - margin - rightX;
    const qrX = pageWidth - margin - qrSize;
    const qrY = margin;

    const doc = new PDFDocument({
      size: [...MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT],
      margin: 0,
      compress: false,
      info: {
        Title: "Member Badge Shipping Label",
        Author: MEMBER_BADGE_APPLICATION_SENDER.name,
        Subject: `Member Badge Application ${application.applicationId}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    // TOP LEFT — FROM
    let y = margin;
    doc.fillColor("#111111");
    doc.font("Helvetica-Bold").fontSize(10).text("FROM", margin, y, {
      width: leftMaxWidth,
      lineGap: 1,
    });
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(10);
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.name, margin, y, { width: leftMaxWidth });
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.addressLine1, margin, doc.y, {
      width: leftMaxWidth,
    });
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.cityProvincePostal, margin, doc.y, {
      width: leftMaxWidth,
    });
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.country, margin, doc.y, { width: leftMaxWidth });

    // TOP RIGHT — QR (safe margin from edge)
    doc.image(qrBuffer, qrX, qrY, {
      width: qrSize,
      height: qrSize,
    });

    // RIGHT — TO / recipient (primary delivery destination, under QR)
    let toY = qrY + qrSize + 14;
    doc.font("Helvetica-Bold").fontSize(11).text("TO", rightX, toY, {
      width: rightWidth,
      lineGap: 1,
    });
    toY = doc.y + 5;
    doc.font("Helvetica-Bold").fontSize(11).text(application.shippingAddress.recipientName, rightX, toY, {
      width: rightWidth,
    });
    doc.font("Helvetica").fontSize(10);
    for (const line of recipientLines) {
      doc.text(line, rightX, doc.y, { width: rightWidth });
    }
    if (application.shippingAddress.phone?.trim()) {
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(9).fillColor("#333333");
      doc.text(`Phone: ${application.shippingAddress.phone.trim()}`, rightX, doc.y, {
        width: rightWidth,
      });
      doc.fillColor("#111111");
    }

    // LOWER LEFT — secondary metadata (does not compete with FROM/TO)
    const metaY = pageHeight - margin - 42;
    doc.font("Helvetica").fontSize(8).fillColor("#555555");
    if (application.memberNumberSnapshot) {
      doc.text(`Member #: ${application.memberNumberSnapshot}`, margin, metaY, {
        width: leftMaxWidth,
      });
    }
    doc.text(`Application: ${application.applicationId}`, margin, doc.y + 2, {
      width: leftMaxWidth,
    });

    doc.end();
  });
}

function resolveFulfillmentEmailDestination(): string {
  const destination = process.env.MEMBER_BADGE_FULFILLMENT_EMAIL?.trim();
  if (!destination) {
    throw new MemberBadgeApplicationValidationError(
      "MEMBER_BADGE_FULFILLMENT_EMAIL is not configured.",
    );
  }
  return destination;
}

export async function emailMemberBadgeApplicationLabel(input: {
  application: MemberBadgeApplicationRecord;
  participantDisplayName: string;
}): Promise<AdminMemberBadgeLabelEmailResult> {
  const to = resolveFulfillmentEmailDestination();
  const { application } = input;
  const address = application.shippingAddress;
  const addressLines = [
    address.recipientName,
    ...formatMemberBadgeApplicationAddressLines(address),
  ];
  if (address.phone?.trim()) {
    addressLines.push(`Phone: ${address.phone.trim()}`);
  }

  const lookupUrl = resolveMemberBadgeApplicationLookupUrl(application.applicationId);

  await sendTransactionalEmail({
    to,
    template: "member_badge_application_label",
    templateInput: {
      applicationId: application.applicationId,
      participantDisplayName: input.participantDisplayName,
      memberNumber: application.memberNumberSnapshot || "—",
      recipientName: address.recipientName,
      shippingAddressBlock: addressLines.join("\n"),
      lookupUrl,
      paymentStatus: application.paymentStatus,
      fulfillmentStatus: application.fulfillmentStatus,
    },
  });

  return {
    queued: true,
    message: "Member Badge shipping label email queued for fulfillment.",
  };
}
