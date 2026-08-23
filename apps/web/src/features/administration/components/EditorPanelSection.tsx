"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { toGeographyCountryOptions } from "@hu/geography";
import type {
  AuthUserPublic,
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
  EditorCapabilityId,
  Initiative,
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
} from "@hu/types";
import { EDITOR_CAPABILITY_LABELS } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { getMyMemberProfile } from "../../member-profile/member-profile-api";
import { resolveDisplayName } from "../../member-profile/participant-profile-surface-presentation";
import {
  activateEditorCountryPerson,
  activateEditorMediaResource,
  blockEditorInitiative,
  blockEditorPublicChoiceCandidate,
  createEditorBetaInvite,
  createEditorCountryPerson,
  createEditorMediaResource,
  deactivateEditorCountryPerson,
  deactivateEditorMediaResource,
  fetchEditorBetaInvites,
  fetchEditorCountryPeople,
  fetchEditorInitiative,
  fetchEditorInitiatives,
  fetchEditorMediaResources,
  fetchEditorPanel,
  fetchEditorPublicChoice,
  fetchEditorPublicChoiceCandidates,
  unblockEditorInitiative,
  unblockEditorPublicChoiceCandidate,
  updateEditorCountryPerson,
  updateEditorMediaResource,
  updateEditorPublicChoiceCandidate,
  type EditorCountryPeopleWriteInput,
  type EditorInitiativeRow,
  type EditorMediaResourceWriteInput,
  type EditorPanelPayload,
  type EditorPanelToolId,
  type EditorPublicChoiceCandidateRow,
  type EditorPublicChoiceRow,
} from "../editor-panel-api";
import { EditorInitiativeEditPanel } from "./EditorInitiativeEditPanel";

import "./editor-panel.css";

interface EditorPanelSectionProps {
  user: AuthUserPublic;
}

function capabilityLabels(capabilities: readonly EditorCapabilityId[]): string {
  return capabilities.map((id) => EDITOR_CAPABILITY_LABELS[id]).join(", ");
}

function emptyMediaForm(): EditorMediaResourceWriteInput {
  return {
    resourceType: "TRUSTED_MEDIA",
    scopeType: "WORLD",
    countryCode: null,
    name: "",
    logoLabel: "",
    logoUrl: null,
    websiteUrl: "",
    rssUrl: null,
    description: null,
    active: true,
    sortOrder: 100,
  };
}

function emptyPeopleForm(defaultCountry: string): EditorCountryPeopleWriteInput {
  return {
    countryCode: defaultCountry || "CA",
    entryType: "TEAM_MEMBER",
    name: "",
    roleOrPosition: "",
    imageUrl: null,
    email: "",
    websiteUrl: "",
    sortOrder: 100,
    active: true,
  };
}

export function EditorPanelSection({ user }: EditorPanelSectionProps) {
  const [panel, setPanel] = useState<EditorPanelPayload | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [initiatives, setInitiatives] = useState<EditorInitiativeRow[]>([]);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);

  const [elections, setElections] = useState<EditorPublicChoiceRow[]>([]);
  const [pcDetailId, setPcDetailId] = useState<string | null>(null);
  const [pcCandidates, setPcCandidates] = useState<EditorPublicChoiceCandidateRow[]>([]);
  const [pcElectionTitle, setPcElectionTitle] = useState("");
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandidateName, setEditCandidateName] = useState("");
  const [editCandidatePhoto, setEditCandidatePhoto] = useState("");
  const [editCandidateCampaign, setEditCandidateCampaign] = useState("");

  const [media, setMedia] = useState<MediaResource[]>([]);
  const [mediaFormOpen, setMediaFormOpen] = useState(false);
  const [mediaEditingId, setMediaEditingId] = useState<string | null>(null);
  const [mediaForm, setMediaForm] = useState<EditorMediaResourceWriteInput>(emptyMediaForm());

  const [people, setPeople] = useState<CountryAffiliationEntry[]>([]);
  const [peopleFormOpen, setPeopleFormOpen] = useState(false);
  const [peopleEditingId, setPeopleEditingId] = useState<string | null>(null);
  const [peopleForm, setPeopleForm] = useState<EditorCountryPeopleWriteInput>(emptyPeopleForm("CA"));

  const [invites, setInvites] = useState<Array<{ inviteId: string; email: string; status: string }>>(
    [],
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const countryOptions = useMemo(
    () => [...toGeographyCountryOptions()].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const reloadPanel = useCallback(async () => {
    const next = await fetchEditorPanel();
    setPanel(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([reloadPanel(), getMyMemberProfile().catch(() => null)])
      .then(([panelPayload, profile]) => {
        if (cancelled) {
          return;
        }
        setPanel(panelPayload);
        setProfileName(
          profile ? resolveDisplayName(profile) : resolveDisplayName({ displayName: user.displayName }),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(formatAuthFormError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadPanel, user.displayName]);

  useEffect(() => {
    if (!panel) {
      return;
    }
    const tools = new Set(panel.tools.map((tool) => tool.toolId));
    let cancelled = false;

    async function loadTools() {
      try {
        if (tools.has("initiatives")) {
          const result = await fetchEditorInitiatives();
          if (!cancelled) {
            setInitiatives(result.items);
          }
        }
        if (tools.has("public-choice")) {
          const result = await fetchEditorPublicChoice();
          if (!cancelled) {
            setElections(result.items);
          }
        }
        if (tools.has("media-resources")) {
          const result = await fetchEditorMediaResources();
          if (!cancelled) {
            setMedia(result.items);
          }
        }
        if (tools.has("country-people")) {
          const result = await fetchEditorCountryPeople();
          if (!cancelled) {
            setPeople(result.items);
          }
        }
        if (tools.has("beta-access")) {
          const result = await fetchEditorBetaInvites();
          if (!cancelled) {
            setInvites(result.invites as typeof invites);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setActionError(formatAuthFormError(err));
        }
      }
    }

    void loadTools();
    return () => {
      cancelled = true;
    };
  }, [panel]);

  if (loading) {
    return <p className="hu-body">Loading Editor Panel…</p>;
  }

  if (error || !panel) {
    return (
      <StatusBanner
        title="Editor Panel unavailable"
        message={error ?? "Unable to load Editor Panel."}
      />
    );
  }

  const scope = panel.editor.geographicScope;
  const hasTool = (id: EditorPanelToolId) => panel.tools.some((tool) => tool.toolId === id);
  const toolMeta = (id: EditorPanelToolId) => panel.tools.find((tool) => tool.toolId === id);

  return (
    <div className="editor-panel">
      <ProfileSection title="Editor Panel">
        <dl className="editor-panel__header" aria-label="Editor identity">
          <div>
            <dt>Editor</dt>
            <dd>{profileName ?? panel.displayName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="editor-panel__status editor-panel__status--active">Active</span>
            </dd>
          </div>
          <div>
            <dt>Editing area</dt>
            <dd>
              <strong>{scope.summary}</strong>
              {scope.detail ? <div className="hu-caption">{scope.detail}</div> : null}
            </dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>{capabilityLabels(panel.editor.capabilities)}</dd>
          </div>
        </dl>
      </ProfileSection>

      {panel.statistics.length > 0 ? (
        <ProfileSection title="Editing area statistics">
          <ul className="editor-panel__stats" aria-label="Scoped content statistics">
            {panel.statistics.map((stat) => (
              <li key={stat.toolId}>
                <span>{stat.label}</span>
                <strong>
                  {stat.value === null
                    ? (stat.unavailableReason ?? "Unavailable")
                    : String(stat.value)}
                </strong>
              </li>
            ))}
          </ul>
          <p className="hu-caption">
            These counts are editable-domain inventory for your grant — not site traffic analytics.
          </p>
        </ProfileSection>
      ) : null}

      {actionError ? (
        <StatusBanner title="Editor action failed" message={actionError} />
      ) : null}

      {hasTool("initiatives") ? (
        <ProfileSection title="Initiatives">
          {editingInitiative ? (
            <EditorInitiativeEditPanel
              initiativeId={editingInitiative.initiativeId}
              initial={editingInitiative}
              onClose={() => setEditingInitiative(null)}
              onSaved={async () => {
                const result = await fetchEditorInitiatives();
                setInitiatives(result.items);
                await reloadPanel();
              }}
            />
          ) : (
            <EditorScopedTable
              empty="No Initiatives in your editing area."
              headers={["Initiative", "Geography", "Status", "Actions"]}
              rows={initiatives.map((row) => [
                row.title,
                row.geographyLabel,
                row.blockLabel ?? row.status,
                <div key={row.initiativeId} className="editor-panel__actions">
                  <Link className="admin-panel__link" href={row.publicHref}>
                    View
                  </Link>
                  {toolMeta("initiatives")?.mutationSupported &&
                  !row.administrativelyBlocked ? (
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setActionError(null);
                        void fetchEditorInitiative(row.initiativeId)
                          .then((initiative) => setEditingInitiative(initiative))
                          .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {toolMeta("initiatives")?.moderationSupported ? (
                    row.blockAuthority === "ADMIN" ? (
                      <span className="hu-caption">Blocked by administrator</span>
                    ) : row.administrativelyBlocked ? (
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setActionError(null);
                          void unblockEditorInitiative(row.initiativeId)
                            .then(async () => {
                              const result = await fetchEditorInitiatives();
                              setInitiatives(result.items);
                              await reloadPanel();
                            })
                            .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                        }}
                      >
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setActionError(null);
                          void blockEditorInitiative(row.initiativeId)
                            .then(async () => {
                              const result = await fetchEditorInitiatives();
                              setInitiatives(result.items);
                              await reloadPanel();
                            })
                            .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                        }}
                      >
                        Block
                      </Button>
                    )
                  ) : null}
                </div>,
              ])}
            />
          )}
        </ProfileSection>
      ) : null}

      {hasTool("public-choice") ? (
        <ProfileSection title="Public Choice">
          <p className="hu-caption">
            Edit and moderate elections/candidates in your editing area when those capabilities are
            granted. Admin blocks cannot be removed by Editors.
          </p>
          {editingInitiative &&
          editingInitiative.lifecycleProfile === "PUBLIC_CHOICE" &&
          !hasTool("initiatives") ? (
            <EditorInitiativeEditPanel
              initiativeId={editingInitiative.initiativeId}
              initial={editingInitiative}
              onClose={() => setEditingInitiative(null)}
              onSaved={async () => {
                const result = await fetchEditorPublicChoice();
                setElections(result.items);
                await reloadPanel();
              }}
            />
          ) : null}
          {pcDetailId ? (
            <div className="editor-panel__edit">
              <div className="editor-panel__actions">
                <strong>{pcElectionTitle}</strong>
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => {
                    setPcDetailId(null);
                    setEditingCandidateId(null);
                  }}
                >
                  Back to elections
                </Button>
              </div>
              <EditorScopedTable
                empty="No candidates in this election."
                headers={["Name", "Campaign URL", "Blocked", "Actions"]}
                rows={pcCandidates.map((candidate) => {
                  const isEditing = editingCandidateId === candidate.candidateId;
                  if (isEditing) {
                    return [
                      <input
                        key="name"
                        value={editCandidateName}
                        onChange={(event) => setEditCandidateName(event.target.value)}
                      />,
                      <div key="fields" className="editor-panel__invite">
                        <input
                          placeholder="Campaign page URL"
                          value={editCandidateCampaign}
                          onChange={(event) => setEditCandidateCampaign(event.target.value)}
                        />
                        <input
                          placeholder="Photo URL"
                          value={editCandidatePhoto}
                          onChange={(event) => setEditCandidatePhoto(event.target.value)}
                        />
                      </div>,
                      candidate.isBlocked ? "Yes" : "No",
                      <div key="actions" className="editor-panel__actions">
                        <Button
                          variant="primary"
                          onClick={() => {
                            setActionError(null);
                            void updateEditorPublicChoiceCandidate(pcDetailId, candidate.candidateId, {
                              name: editCandidateName.trim(),
                              campaignPageUrl: editCandidateCampaign.trim() || null,
                              photoUrl: editCandidatePhoto.trim() || null,
                            })
                              .then(async () => {
                                const detail = await fetchEditorPublicChoiceCandidates(pcDetailId);
                                setPcCandidates(detail.candidates);
                                setEditingCandidateId(null);
                              })
                              .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="tertiary"
                          onClick={() => setEditingCandidateId(null)}
                        >
                          Cancel
                        </Button>
                      </div>,
                    ];
                  }
                  return [
                    candidate.name,
                    candidate.campaignPageUrl ?? "—",
                    candidate.blockLabel ?? (candidate.isBlocked ? "Blocked" : "No"),
                    <div key={candidate.candidateId} className="editor-panel__actions">
                      {toolMeta("public-choice")?.mutationSupported &&
                      !candidate.isBlocked ? (
                        <Button
                          variant="tertiary"
                          onClick={() => {
                            setEditingCandidateId(candidate.candidateId);
                            setEditCandidateName(candidate.name);
                            setEditCandidateCampaign(candidate.campaignPageUrl ?? "");
                            setEditCandidatePhoto(candidate.photoUrl ?? "");
                          }}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {toolMeta("public-choice")?.moderationSupported ? (
                        candidate.blockAuthority === "ADMIN" ? (
                          <span className="hu-caption">Blocked by administrator</span>
                        ) : candidate.isBlocked ? (
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              setActionError(null);
                              void unblockEditorPublicChoiceCandidate(
                                pcDetailId,
                                candidate.candidateId,
                              )
                                .then(async () => {
                                  const detail =
                                    await fetchEditorPublicChoiceCandidates(pcDetailId);
                                  setPcCandidates(detail.candidates);
                                })
                                .catch((err: unknown) =>
                                  setActionError(formatAuthFormError(err)),
                                );
                            }}
                          >
                            Unblock
                          </Button>
                        ) : (
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              setActionError(null);
                              void blockEditorPublicChoiceCandidate(
                                pcDetailId,
                                candidate.candidateId,
                              )
                                .then(async () => {
                                  const detail =
                                    await fetchEditorPublicChoiceCandidates(pcDetailId);
                                  setPcCandidates(detail.candidates);
                                })
                                .catch((err: unknown) =>
                                  setActionError(formatAuthFormError(err)),
                                );
                            }}
                          >
                            Block
                          </Button>
                        )
                      ) : candidate.isBlocked ? (
                        <span className="hu-caption">
                          {candidate.blockLabel ?? "Blocked"}
                        </span>
                      ) : null}
                    </div>,
                  ];
                })}
              />
            </div>
          ) : (
            <EditorScopedTable
              empty="No Public Choice elections in your editing area."
              headers={["Election", "Geography", "Candidates", "Status", "Actions"]}
              rows={elections.map((row) => [
                row.electionTitle,
                row.geographyLabel,
                String(row.candidateCount),
                row.blockLabel ?? row.votingStatus,
                <div key={row.initiativeId} className="editor-panel__actions">
                  <Link className="admin-panel__link" href={row.publicHref}>
                    View
                  </Link>
                  {toolMeta("public-choice")?.mutationSupported &&
                  !row.administrativelyBlocked ? (
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setActionError(null);
                        void fetchEditorInitiative(row.initiativeId)
                          .then((initiative) => setEditingInitiative(initiative))
                          .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                      }}
                    >
                      Edit election
                    </Button>
                  ) : null}
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setActionError(null);
                      void fetchEditorPublicChoiceCandidates(row.initiativeId)
                        .then((detail) => {
                          setPcDetailId(detail.initiativeId);
                          setPcElectionTitle(detail.electionTitle);
                          setPcCandidates(detail.candidates);
                        })
                        .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                    }}
                  >
                    Candidates
                  </Button>
                  {toolMeta("public-choice")?.moderationSupported ? (
                    row.blockAuthority === "ADMIN" ? (
                      <span className="hu-caption">Blocked by administrator</span>
                    ) : row.administrativelyBlocked ? (
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setActionError(null);
                          void unblockEditorInitiative(row.initiativeId)
                            .then(async () => {
                              const result = await fetchEditorPublicChoice();
                              setElections(result.items);
                              await reloadPanel();
                            })
                            .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                        }}
                      >
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setActionError(null);
                          void blockEditorInitiative(row.initiativeId)
                            .then(async () => {
                              const result = await fetchEditorPublicChoice();
                              setElections(result.items);
                              await reloadPanel();
                            })
                            .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                        }}
                      >
                        Block
                      </Button>
                    )
                  ) : null}
                </div>,
              ])}
            />
          )}
        </ProfileSection>
      ) : null}

      {hasTool("media-resources") ? (
        <ProfileSection title="Media Resources">
          {toolMeta("media-resources")?.mutationSupported === false ? (
            <p className="hu-caption">{toolMeta("media-resources")?.unavailableReason}</p>
          ) : (
            <>
              <div className="editor-panel__actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setMediaEditingId(null);
                    setMediaForm(emptyMediaForm());
                    setMediaFormOpen(true);
                  }}
                >
                  Add media resource
                </Button>
              </div>
              {mediaFormOpen ? (
                <form
                  className="editor-panel__invite"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setActionError(null);
                    const payload: EditorMediaResourceWriteInput = {
                      ...mediaForm,
                      countryCode: mediaForm.scopeType === "WORLD" ? null : mediaForm.countryCode,
                    };
                    void (mediaEditingId
                      ? updateEditorMediaResource(mediaEditingId, {
                          scopeType: payload.scopeType,
                          countryCode: payload.countryCode,
                          name: payload.name,
                          logoLabel: payload.logoLabel,
                          logoUrl: payload.logoUrl,
                          websiteUrl: payload.websiteUrl,
                          rssUrl: payload.rssUrl,
                          description: payload.description,
                          active: payload.active,
                          sortOrder: payload.sortOrder,
                        })
                      : createEditorMediaResource(payload)
                    )
                      .then(async () => {
                        setMediaFormOpen(false);
                        setMediaEditingId(null);
                        const result = await fetchEditorMediaResources();
                        setMedia(result.items);
                        await reloadPanel();
                      })
                      .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                  }}
                >
                  <h3>{mediaEditingId ? "Edit media resource" : "Add media resource"}</h3>
                  <label>
                    Type
                    <select
                      value={mediaForm.resourceType}
                      disabled={Boolean(mediaEditingId)}
                      onChange={(event) =>
                        setMediaForm((current) => ({
                          ...current,
                          resourceType: event.target.value as MediaResourceType,
                        }))
                      }
                    >
                      <option value="TRUSTED_MEDIA">Trusted media</option>
                      <option value="NEWS_SOURCE">News source</option>
                      <option value="FACT_CHECKING">Fact checking</option>
                      <option value="PROPAGANDA_ANALYSIS">Propaganda analysis</option>
                    </select>
                  </label>
                  <label>
                    Scope
                    <select
                      value={mediaForm.scopeType}
                      onChange={(event) => {
                        const scopeType = event.target.value as MediaResourceScopeType;
                        setMediaForm((current) => ({
                          ...current,
                          scopeType,
                          countryCode: scopeType === "WORLD" ? null : current.countryCode,
                        }));
                      }}
                    >
                      <option value="WORLD">WORLD</option>
                      <option value="COUNTRY">COUNTRY</option>
                    </select>
                  </label>
                  {mediaForm.scopeType === "COUNTRY" ? (
                    <label>
                      Country
                      <select
                        value={mediaForm.countryCode ?? ""}
                        onChange={(event) =>
                          setMediaForm((current) => ({
                            ...current,
                            countryCode: event.target.value || null,
                          }))
                        }
                        required
                      >
                        <option value="">Select country</option>
                        {countryOptions.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Name
                    <input
                      value={mediaForm.name}
                      onChange={(event) =>
                        setMediaForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Logo label
                    <input
                      value={mediaForm.logoLabel}
                      onChange={(event) =>
                        setMediaForm((current) => ({ ...current, logoLabel: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Website URL
                    <input
                      value={mediaForm.websiteUrl}
                      onChange={(event) =>
                        setMediaForm((current) => ({ ...current, websiteUrl: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Logo URL
                    <input
                      value={mediaForm.logoUrl ?? ""}
                      onChange={(event) =>
                        setMediaForm((current) => ({
                          ...current,
                          logoUrl: event.target.value || null,
                        }))
                      }
                    />
                  </label>
                  <div className="editor-panel__actions">
                    <Button type="submit" variant="primary">
                      {mediaEditingId ? "Save" : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={() => {
                        setMediaFormOpen(false);
                        setMediaEditingId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
              <EditorScopedTable
                empty="No Media Resources in your editing area."
                headers={["Name", "Scope", "Status", "Actions"]}
                rows={media.map((row) => [
                  row.name,
                  row.scopeType === "WORLD" ? "World" : `Country ${row.countryCode ?? ""}`,
                  row.active ? "Active" : "Inactive",
                  <div key={row.id} className="editor-panel__actions">
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setMediaEditingId(row.id);
                        setMediaForm({
                          resourceType: row.resourceType,
                          scopeType: row.scopeType,
                          countryCode: row.countryCode ?? null,
                          name: row.name,
                          logoLabel: row.logoLabel,
                          logoUrl: row.logoUrl ?? null,
                          websiteUrl: row.websiteUrl,
                          rssUrl: row.rssUrl ?? null,
                          description: row.description ?? null,
                          active: row.active,
                          sortOrder: row.sortOrder,
                        });
                        setMediaFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setActionError(null);
                        void (row.active
                          ? deactivateEditorMediaResource(row.id)
                          : activateEditorMediaResource(row.id)
                        )
                          .then(async () => {
                            const result = await fetchEditorMediaResources();
                            setMedia(result.items);
                            await reloadPanel();
                          })
                          .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                      }}
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>,
                ])}
              />
            </>
          )}
        </ProfileSection>
      ) : null}

      {hasTool("country-people") ? (
        <ProfileSection title="Country Team & Partners">
          {toolMeta("country-people")?.mutationSupported === false ? (
            <p className="hu-caption">{toolMeta("country-people")?.unavailableReason}</p>
          ) : (
            <>
              <div className="editor-panel__actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setPeopleEditingId(null);
                    setPeopleForm(
                      emptyPeopleForm(
                        scope.level === "COUNTRY" && scope.countryCode
                          ? scope.countryCode
                          : "CA",
                      ),
                    );
                    setPeopleFormOpen(true);
                  }}
                >
                  Add entry
                </Button>
              </div>
              {peopleFormOpen ? (
                <form
                  className="editor-panel__invite"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setActionError(null);
                    void (peopleEditingId
                      ? updateEditorCountryPerson(peopleEditingId, peopleForm)
                      : createEditorCountryPerson(peopleForm)
                    )
                      .then(async () => {
                        setPeopleFormOpen(false);
                        setPeopleEditingId(null);
                        const result = await fetchEditorCountryPeople();
                        setPeople(result.items);
                        await reloadPanel();
                      })
                      .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                  }}
                >
                  <h3>{peopleEditingId ? "Edit entry" : "Add entry"}</h3>
                  <label>
                    Country
                    <select
                      value={peopleForm.countryCode}
                      onChange={(event) =>
                        setPeopleForm((current) => ({
                          ...current,
                          countryCode: event.target.value,
                        }))
                      }
                    >
                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select
                      value={peopleForm.entryType}
                      disabled={Boolean(peopleEditingId)}
                      onChange={(event) =>
                        setPeopleForm((current) => ({
                          ...current,
                          entryType: event.target.value as CountryAffiliationEntryType,
                        }))
                      }
                    >
                      <option value="TEAM_MEMBER">Team member</option>
                      <option value="PARTNER">Partner</option>
                    </select>
                  </label>
                  <label>
                    Name
                    <input
                      value={peopleForm.name}
                      onChange={(event) =>
                        setPeopleForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Role / Position
                    <input
                      value={peopleForm.roleOrPosition ?? ""}
                      onChange={(event) =>
                        setPeopleForm((current) => ({
                          ...current,
                          roleOrPosition: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Website URL
                    <input
                      value={peopleForm.websiteUrl ?? ""}
                      onChange={(event) =>
                        setPeopleForm((current) => ({
                          ...current,
                          websiteUrl: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="editor-panel__actions">
                    <Button type="submit" variant="primary">
                      {peopleEditingId ? "Save" : "Create"}
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={() => {
                        setPeopleFormOpen(false);
                        setPeopleEditingId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
              <EditorScopedTable
                empty="No Team & Partners entries in your editing area."
                headers={["Name", "Country", "Type", "Status", "Actions"]}
                rows={people.map((row) => [
                  row.name,
                  row.countryCode,
                  row.entryType,
                  row.active ? "Active" : "Inactive",
                  <div key={row.entryId} className="editor-panel__actions">
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setPeopleEditingId(row.entryId);
                        setPeopleForm({
                          countryCode: row.countryCode,
                          entryType: row.entryType,
                          name: row.name,
                          roleOrPosition: row.roleOrPosition ?? "",
                          imageUrl: row.imageUrl ?? null,
                          email: row.email ?? "",
                          websiteUrl: row.websiteUrl ?? "",
                          sortOrder: row.sortOrder,
                          active: row.active,
                        });
                        setPeopleFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setActionError(null);
                        void (row.active
                          ? deactivateEditorCountryPerson(row.entryId)
                          : activateEditorCountryPerson(row.entryId)
                        )
                          .then(async () => {
                            const result = await fetchEditorCountryPeople();
                            setPeople(result.items);
                            await reloadPanel();
                          })
                          .catch((err: unknown) => setActionError(formatAuthFormError(err)));
                      }}
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>,
                ])}
              />
            </>
          )}
        </ProfileSection>
      ) : null}

      {hasTool("beta-access") ? (
        <ProfileSection title="Beta Access">
          <form
            className="editor-panel__invite"
            onSubmit={(event) => {
              event.preventDefault();
              setActionError(null);
              void createEditorBetaInvite(inviteEmail)
                .then(async () => {
                  setInviteEmail("");
                  const result = await fetchEditorBetaInvites();
                  setInvites(result.invites as typeof invites);
                })
                .catch((err: unknown) => setActionError(formatAuthFormError(err)));
            }}
          >
            <label htmlFor="editor-beta-email">Invite email</label>
            <input
              id="editor-beta-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              required
            />
            <Button type="submit" variant="primary">
              Create invite
            </Button>
          </form>
          <EditorScopedTable
            empty="No invites created by you yet."
            headers={["Email", "Status"]}
            rows={invites.map((row) => [row.email, row.status])}
          />
        </ProfileSection>
      ) : null}
    </div>
  );
}

function EditorScopedTable(props: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  return (
    <div className="editor-panel__table-wrap">
      <table className="editor-panel__table">
        <thead>
          <tr>
            {props.headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td colSpan={props.headers.length}>{props.empty}</td>
            </tr>
          ) : (
            props.rows.map((cells, index) => (
              <tr key={index}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
