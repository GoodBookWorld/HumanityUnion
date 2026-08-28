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

export async function generateLabelPdfBuffer(
  application: MemberBadgeApplicationRecord,
): Promise<Buffer> {
  const qrDataUrl = await generateLabelQrDataUrl(application.applicationId);
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");
  const recipientLines = formatMemberBadgeApplicationAddressLines(application.shippingAddress);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [...MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT],
      margin: 36,
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

    doc.font("Helvetica-Bold").fontSize(11).text("FROM");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10);
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.name);
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.addressLine1);
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.cityProvincePostal);
    doc.text(MEMBER_BADGE_APPLICATION_SENDER.country);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text("TO");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11);
    doc.text(application.shippingAddress.recipientName);
    for (const line of recipientLines) {
      doc.text(line);
    }
    if (application.shippingAddress.phone?.trim()) {
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9).text(`Phone: ${application.shippingAddress.phone.trim()}`);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(9);
    if (application.memberNumberSnapshot) {
      doc.text(`Member #: ${application.memberNumberSnapshot}`);
    }
    doc.text(`Application: ${application.applicationId}`);

    const pageWidth = MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT[0];
    const pageHeight = MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT[1];
    const qrSize = 100;
    doc.image(qrBuffer, pageWidth - 36 - qrSize, pageHeight - 36 - qrSize, {
      width: qrSize,
      height: qrSize,
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
