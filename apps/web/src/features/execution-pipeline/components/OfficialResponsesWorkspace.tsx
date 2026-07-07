"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Initiative, OfficialResponseType } from "@hu/types";

import { listPublicCivicActionPackagesForInitiative } from "../../civic-action-package/api";
import { listMyCivicDeliveries } from "../../civic-delivery/api";
import { BOOTSTRAP_PARTICIPANT_ID } from "../../petition/petition-utils";
import {
  createOfficialResponseDraft,
  listMyOfficialResponses,
  publishOfficialResponse,
  verifyOfficialResponse,
} from "../../official-response/api";

import {
  WorkspaceButton,
  WorkspaceEmptyState,
  WorkspaceHelperNote,
  WorkspacePublicLink,
  WorkspaceRecordItem,
  WorkspaceRecordList,
  WorkspaceSectionShell,
  WorkspaceStatusBadge,
} from "../../initiative-workspace-ux";

const RESPONSE_TYPES: OfficialResponseType[] = [
  "official_letter",
  "email",
  "public_statement",
  "meeting_minutes",
  "policy_update",
  "decision_notice",
  "media_response",
  "other",
];

function isSteward(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_PARTICIPANT_ID;
}

interface OfficialResponsesWorkspaceProps {
  initiative: Initiative;
}

export function OfficialResponsesWorkspace({ initiative }: OfficialResponsesWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof listMyOfficialResponses>>>(
    [],
  );
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [responseReference, setResponseReference] = useState("");
  const [responseType, setResponseType] = useState<OfficialResponseType>("official_letter");
  const [recipientOptions, setRecipientOptions] = useState<
    Array<{ recipientId: string; label: string; deliveryId: string; capId: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const steward = isSteward(initiative);

  const initiativeResponses = useMemo(
    () => responses.filter((response) => response.initiativeId === initiative.initiativeId),
    [initiative.initiativeId, responses],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [myResponses, capResponse, myDeliveries] = await Promise.all([
        listMyOfficialResponses(),
        listPublicCivicActionPackagesForInitiative(initiative.initiativeId),
        listMyCivicDeliveries(),
      ]);

      setResponses(myResponses);

      const sentDeliveries = myDeliveries.filter(
        (detail) =>
          detail.delivery.initiativeId === initiative.initiativeId &&
          detail.delivery.status === "sent",
      );

      const options = sentDeliveries.flatMap((detail) =>
        detail.recipients
          .filter((recipient) => recipient.deliveryStatus === "sent")
          .map((recipient) => ({
            recipientId: recipient.recipientId,
            deliveryId: detail.delivery.deliveryId,
            capId: detail.delivery.capId,
            label: `${recipient.name}${recipient.organization ? ` (${recipient.organization})` : ""}`,
          })),
      );

      setRecipientOptions(options);

      const firstCap = capResponse.packages[0]?.capId ?? null;
      setActiveCapId(firstCap);

      const firstOption = options[0];
      if (firstOption) {
        setActiveDeliveryId(firstOption.deliveryId);
        setActiveRecipientId(firstOption.recipientId);
        setActiveCapId(firstOption.capId);
      }
    } catch {
      setError("Official responses are not available for this initiative yet.");
      setResponses([]);
      setRecipientOptions([]);
    } finally {
      setLoading(false);
    }
  }, [initiative.initiativeId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleCreateDraft = async () => {
    if (!activeCapId || !activeDeliveryId || !activeRecipientId) {
      return;
    }

    setSubmitting(true);

    try {
      const created = await createOfficialResponseDraft({
        capId: activeCapId,
        deliveryId: activeDeliveryId,
        recipientId: activeRecipientId,
        organizationName,
        receivedAt: receivedAt || new Date().toISOString(),
        subject,
        summary,
        responseReference,
        responseType,
      });

      setResponses((current) => [...current, created]);
      setOrganizationName("");
      setReceivedAt("");
      setSubject("");
      setSummary("");
      setResponseReference("");
    } catch {
      setError("Unable to create official response draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (responseId: string) => {
    try {
      const published = await publishOfficialResponse(responseId);
      setResponses((current) =>
        current.map((response) => (response.responseId === responseId ? published : response)),
      );
    } catch {
      setError("Unable to publish official response.");
    }
  };

  const handleVerify = async (
    responseId: string,
    verificationState: "verified" | "unable_to_verify",
  ) => {
    try {
      const verified = await verifyOfficialResponse(responseId, verificationState);
      setResponses((current) =>
        current.map((response) => (response.responseId === responseId ? verified : response)),
      );
    } catch {
      setError("Only the initiative steward may verify official responses.");
    }
  };

  return (
    <WorkspaceSectionShell
      purpose={
        <>
          Official Responses are the constitutional public record of institutional replies after
          civic delivery. Humanity Union records facts — it does not evaluate whether a response is
          good or bad.
        </>
      }
      loading={loading ? "Loading official responses..." : null}
      error={error}
    >
      <WorkspaceHelperNote>
        Incoming mailbox automation is coming in a future release. Until then, responses may be
        entered manually after a sent civic delivery.
      </WorkspaceHelperNote>

      {recipientOptions.length > 0 ? (
        <>
          <h3>Record official response (manual entry)</h3>
          <label>
            Delivery recipient
            <select
              value={activeRecipientId ?? ""}
              onChange={(event) => {
                const option = recipientOptions.find(
                  (item) => item.recipientId === event.target.value,
                );
                setActiveRecipientId(event.target.value);
                setActiveDeliveryId(option?.deliveryId ?? null);
                setActiveCapId(option?.capId ?? null);
              }}
            >
              {recipientOptions.map((option) => (
                <option key={option.recipientId} value={option.recipientId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <input
            placeholder="Organization name"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
          />
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(event) => setReceivedAt(event.target.value)}
          />
          <input
            placeholder="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <textarea
            placeholder="Public summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
          <input
            placeholder="Response reference (case number, letter ID, etc.)"
            value={responseReference}
            onChange={(event) => setResponseReference(event.target.value)}
          />
          <label>
            Response type
            <select
              value={responseType}
              onChange={(event) => setResponseType(event.target.value as OfficialResponseType)}
            >
              {RESPONSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <WorkspaceButton
            variant="primary"
            disabled={submitting}
            onClick={() => void handleCreateDraft()}
          >
            {submitting ? "Saving..." : "Create draft response"}
          </WorkspaceButton>
        </>
      ) : (
        <WorkspaceEmptyState
          title="No sent civic delivery recipients yet"
          explanation="Official responses attach to recipients who received a sent civic delivery."
          nextStep="Send a civic delivery first, then record the institution response here."
        />
      )}

      {initiativeResponses.length > 0 ? (
        <WorkspaceRecordList>
          {initiativeResponses.map((response) => (
            <WorkspaceRecordItem
              key={response.responseId}
              title={
                <strong>
                  {response.responseNumber} — {response.organizationName}
                </strong>
              }
              meta={
                <>
                  <WorkspaceStatusBadge status={response.publicationStatus} /> ·{" "}
                  <WorkspaceStatusBadge status={response.verificationState} /> ·{" "}
                  {response.responseType.replace(/_/g, " ")}
                </>
              }
              body={
                <>
                  {response.summary}
                  <div className="workspace-actions">
                    {response.publicationStatus === "draft" ? (
                      <WorkspaceButton
                        variant="primary"
                        onClick={() => void handlePublish(response.responseId)}
                      >
                        Publish
                      </WorkspaceButton>
                    ) : null}
                    {response.publicationStatus === "published" &&
                    response.verificationState === "pending" &&
                    steward ? (
                      <>
                        <WorkspaceButton
                          variant="secondary"
                          onClick={() => void handleVerify(response.responseId, "verified")}
                        >
                          Verify
                        </WorkspaceButton>
                        <WorkspaceButton
                          variant="secondary"
                          onClick={() => void handleVerify(response.responseId, "unable_to_verify")}
                        >
                          Unable to verify
                        </WorkspaceButton>
                      </>
                    ) : null}
                    {response.publicationStatus !== "draft" ? (
                      <WorkspacePublicLink
                        href={`/public-responses/${encodeURIComponent(response.responseId)}`}
                        label="View Public Page"
                      />
                    ) : null}
                  </div>
                </>
              }
            />
          ))}
        </WorkspaceRecordList>
      ) : recipientOptions.length > 0 ? (
        <WorkspaceEmptyState
          title="No official responses recorded yet"
          explanation="Draft and published responses for this initiative will appear here."
          nextStep="Create a draft response after selecting a sent delivery recipient."
        />
      ) : null}
    </WorkspaceSectionShell>
  );
}
