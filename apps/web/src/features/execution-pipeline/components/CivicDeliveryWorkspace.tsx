"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Initiative, RecommendedCivicDeliveryRecipient } from "@hu/types";

import { listPublicCivicActionPackagesForInitiative } from "../../civic-action-package/api";
import {
  addCivicDeliveryRecipient,
  createCivicDeliveryDraft,
  getRecommendedCivicDeliveryRecipients,
  listMyCivicDeliveries,
  removeCivicDeliveryRecipient,
  sendCivicDelivery,
  type CivicDeliveryDetail,
} from "../../civic-delivery/api";

import "./execution-pipeline-workspace.css";

interface CivicDeliveryWorkspaceProps {
  initiative: Initiative;
}

export function CivicDeliveryWorkspace({ initiative }: CivicDeliveryWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<
    Awaited<ReturnType<typeof listPublicCivicActionPackagesForInitiative>>["packages"]
  >([]);
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [deliveryDetail, setDeliveryDetail] = useState<CivicDeliveryDetail | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedCivicDeliveryRecipient[]>([]);
  const [history, setHistory] = useState<CivicDeliveryDetail[]>([]);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [sending, setSending] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [capResponse, myDeliveries] = await Promise.all([
        listPublicCivicActionPackagesForInitiative(initiative.initiativeId),
        listMyCivicDeliveries(),
      ]);

      setCaps(capResponse.packages);
      setHistory(
        myDeliveries.filter((detail) => detail.delivery.initiativeId === initiative.initiativeId),
      );

      const firstCap = capResponse.packages[0]?.capId ?? null;
      setActiveCapId(firstCap);

      if (firstCap) {
        const draft = myDeliveries.find(
          (detail) => detail.delivery.capId === firstCap && detail.delivery.status === "draft",
        );

        if (draft) {
          setDeliveryDetail(draft);
        } else {
          const created = await createCivicDeliveryDraft(firstCap);
          setDeliveryDetail({ delivery: created, recipients: [] });
        }

        const recommended = await getRecommendedCivicDeliveryRecipients(firstCap);
        setRecommendations(recommended);
      }
    } catch {
      setError("Civic delivery is not available for this initiative yet.");
      setCaps([]);
      setDeliveryDetail(null);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleAddRecommended = async (recommended: RecommendedCivicDeliveryRecipient) => {
    if (!deliveryDetail || deliveryDetail.delivery.status !== "draft") {
      return;
    }

    try {
      const recipient = await addCivicDeliveryRecipient(deliveryDetail.delivery.deliveryId, {
        name: recommended.name,
        organization: recommended.organization,
        recipientType: recommended.recipientType,
        email: recommended.email,
        reason: recommended.reason,
        source: "recommended",
      });

      setDeliveryDetail({
        ...deliveryDetail,
        recipients: [...deliveryDetail.recipients, recipient],
      });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add recipient.");
    }
  };

  const handleAddCustom = async () => {
    if (!deliveryDetail || deliveryDetail.delivery.status !== "draft") {
      return;
    }

    try {
      const recipient = await addCivicDeliveryRecipient(deliveryDetail.delivery.deliveryId, {
        name: customName,
        email: customEmail,
        recipientType: "other",
        reason: customReason || "User-selected civic delivery recipient.",
        source: "user_added",
      });

      setDeliveryDetail({
        ...deliveryDetail,
        recipients: [...deliveryDetail.recipients, recipient],
      });
      setCustomName("");
      setCustomEmail("");
      setCustomReason("");
      setError(null);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add custom recipient.");
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!deliveryDetail || deliveryDetail.delivery.status !== "draft") {
      return;
    }

    try {
      await removeCivicDeliveryRecipient(deliveryDetail.delivery.deliveryId, recipientId);
      setDeliveryDetail({
        ...deliveryDetail,
        recipients: deliveryDetail.recipients.filter(
          (recipient) => recipient.recipientId !== recipientId,
        ),
      });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove recipient.");
    }
  };

  const handleSend = async () => {
    if (!deliveryDetail || deliveryDetail.delivery.status !== "draft") {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const sent = await sendCivicDelivery(deliveryDetail.delivery.deliveryId);
      setDeliveryDetail(sent);
      setHistory((current) => [
        sent,
        ...current.filter((item) => item.delivery.deliveryId !== sent.delivery.deliveryId),
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send delivery.");
    } finally {
      setSending(false);
    }
  };

  const activeCap = caps.find((capPackage) => capPackage.capId === activeCapId);

  return (
    <div className="execution-pipeline-workspace">
      <p className="execution-pipeline-workspace__pipeline">
        Civic delivery: Civic Action Package → Recommended Recipients → Recipient Selection → Send →
        Public Delivery Log
      </p>
      <p className="execution-pipeline-workspace__note">
        Delivery records civic facts transparently. Humanity Union does not judge recipient
        behavior. Dev simulated mode is active when no email provider is configured.
      </p>

      {loading ? (
        <p className="execution-pipeline-workspace__empty">Loading civic delivery workspace...</p>
      ) : null}

      {error ? <p className="execution-pipeline-workspace__empty">{error}</p> : null}

      {!loading && caps.length === 0 ? (
        <p className="execution-pipeline-workspace__empty">
          No issued Civic Action Packages are available for delivery yet.
        </p>
      ) : null}

      {activeCap ? (
        <p className="execution-pipeline-workspace__meta">
          Active CAP:{" "}
          <Link href={`/civic-action-packages/public/${encodeURIComponent(activeCap.capId)}`}>
            CAP #{activeCap.capNumber}
          </Link>
        </p>
      ) : null}

      {deliveryDetail?.delivery.status === "draft" ? (
        <>
          <h3>Recommended recipients</h3>
          <ul className="execution-pipeline-workspace__list">
            {recommendations.map((recommended) => (
              <li key={`${recommended.email}-${recommended.recipientType}`}>
                <strong>{recommended.name}</strong> ({recommended.recipientType})
                <p className="execution-pipeline-workspace__meta">{recommended.reason}</p>
                <button type="button" onClick={() => void handleAddRecommended(recommended)}>
                  Select recipient
                </button>
              </li>
            ))}
          </ul>

          <h3>Selected recipients</h3>
          {deliveryDetail.recipients.length === 0 ? (
            <p className="execution-pipeline-workspace__empty">No recipients selected yet.</p>
          ) : (
            <ul className="execution-pipeline-workspace__list">
              {deliveryDetail.recipients.map((recipient) => (
                <li key={recipient.recipientId}>
                  <strong>{recipient.name}</strong> ({recipient.recipientType}) · {recipient.source}
                  <p className="execution-pipeline-workspace__meta">{recipient.reason}</p>
                  <button
                    type="button"
                    onClick={() => void handleRemoveRecipient(recipient.recipientId)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3>Add custom recipient</h3>
          <div>
            <input
              placeholder="Recipient name"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
            />
            <input
              placeholder="Email address"
              value={customEmail}
              onChange={(event) => setCustomEmail(event.target.value)}
            />
            <input
              placeholder="Reason for delivery"
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
            />
            <button type="button" onClick={() => void handleAddCustom()}>
              Add custom recipient
            </button>
          </div>

          <button type="button" disabled={sending} onClick={() => void handleSend()}>
            {sending ? "Sending..." : "Send (dev simulated)"}
          </button>
        </>
      ) : null}

      {deliveryDetail?.delivery.status === "sent" ? (
        <p className="execution-pipeline-workspace__meta">
          Delivery sent via {deliveryDetail.delivery.deliveryMode ?? "dev_simulated"} on{" "}
          {deliveryDetail.delivery.sentAt
            ? new Date(deliveryDetail.delivery.sentAt).toLocaleString()
            : "unknown time"}
          .
        </p>
      ) : null}

      {history.filter((detail) => detail.delivery.status === "sent").length > 0 ? (
        <>
          <h3>Delivery history</h3>
          <ul className="execution-pipeline-workspace__list">
            {history
              .filter((detail) => detail.delivery.status === "sent")
              .map((detail) => (
                <li key={detail.delivery.deliveryId}>
                  Sent {detail.recipients.filter((r) => r.deliveryStatus === "sent").length} of{" "}
                  {detail.recipients.length} recipients · {detail.delivery.deliveryMode}
                </li>
              ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
