"use client";

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

import {
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceHelperNote,
  WorkspacePublicLink,
  WorkspaceRecordList,
  WorkspaceSectionShell,
} from "../../initiative-workspace-ux";

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
    <WorkspaceSectionShell
      purpose="Delivery records civic facts transparently. Humanity Union does not judge recipient behavior. Dev simulated mode is active when no email provider is configured."
      loading={loading ? "Loading civic delivery workspace..." : null}
      error={error}
      emptyState={
        !loading && caps.length === 0 ? (
          <WorkspaceEmptyState
            title="No Civic Action Package is available for delivery yet"
            explanation="Civic delivery requires an issued Civic Action Package from a closed collective decision."
            nextStep="Complete collective decision and issue a Civic Action Package before selecting recipients."
          />
        ) : null
      }
    >
      <WorkspaceHelperNote>
        Civic delivery: Civic Action Package → Recommended Recipients → Recipient Selection → Send →
        Public Delivery Log
      </WorkspaceHelperNote>

      {activeCap ? (
        <p className="workspace-record-item__meta">
          Active CAP:{" "}
          <WorkspacePublicLink
            href={`/civic-action-packages/public/${encodeURIComponent(activeCap.capId)}`}
            label={`View Civic Action Package #${activeCap.capNumber}`}
          />
        </p>
      ) : null}

      {deliveryDetail?.delivery.status === "draft" ? (
        <>
          <h3>Recommended recipients</h3>
          <WorkspaceRecordList>
            {recommendations.map((recommended) => (
              <li key={`${recommended.email}-${recommended.recipientType}`}>
                <strong>{recommended.name}</strong> ({recommended.recipientType})
                <p className="workspace-record-item__meta">{recommended.reason}</p>
                <WorkspaceButton
                  variant="secondary"
                  onClick={() => void handleAddRecommended(recommended)}
                >
                  Select recipient
                </WorkspaceButton>
              </li>
            ))}
          </WorkspaceRecordList>

          <h3>Selected recipients</h3>
          {deliveryDetail.recipients.length === 0 ? (
            <WorkspaceEmptyState
              title="No recipients selected yet"
              explanation="Select recommended recipients or add a custom recipient before sending."
              nextStep="Add at least one recipient to prepare civic delivery."
            />
          ) : (
            <WorkspaceRecordList>
              {deliveryDetail.recipients.map((recipient) => (
                <li key={recipient.recipientId}>
                  <strong>{recipient.name}</strong> ({recipient.recipientType}) · {recipient.source}
                  <p className="workspace-record-item__meta">{recipient.reason}</p>
                  <WorkspaceButton
                    variant="danger"
                    onClick={() => void handleRemoveRecipient(recipient.recipientId)}
                  >
                    Remove
                  </WorkspaceButton>
                </li>
              ))}
            </WorkspaceRecordList>
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
            <WorkspaceButton variant="secondary" onClick={() => void handleAddCustom()}>
              Add custom recipient
            </WorkspaceButton>
          </div>

          <WorkspaceButton variant="primary" disabled={sending} onClick={() => void handleSend()}>
            {sending ? "Sending..." : "Send (dev simulated)"}
          </WorkspaceButton>
        </>
      ) : null}

      {deliveryDetail?.delivery.status === "sent" ? (
        <p className="workspace-record-item__meta">
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
          <WorkspaceRecordList>
            {history
              .filter((detail) => detail.delivery.status === "sent")
              .map((detail) => (
                <li key={detail.delivery.deliveryId}>
                  Sent {detail.recipients.filter((r) => r.deliveryStatus === "sent").length} of{" "}
                  {detail.recipients.length} recipients · {detail.delivery.deliveryMode}
                </li>
              ))}
          </WorkspaceRecordList>
        </>
      ) : null}
    </WorkspaceSectionShell>
  );
}
