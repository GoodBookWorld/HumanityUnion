"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { Petition, PublicPetitionRecord } from "@hu/types";

import { listReadablePetitions } from "../../petition/api";
import {
  createPetitionWorkingDraft,
  deletePetitionWorkingDraft,
  listPetitionWorkingDrafts,
  type PetitionWorkingDraft,
} from "../api";
import {
  classifyPetitionDraftError,
  computePetitionSlotSummary,
  petitionDraftErrorRequiresReload,
  selectInitiativePublishedPetitions,
  type PetitionDraftErrorKind,
} from "../petition-editing-workspace";
import {
  PetitionEditingWorkspacePanel,
  type PetitionEditingNotice,
  type PetitionEditingWorkspaceState,
} from "./PetitionEditingWorkspacePanel";
import { PetitionWorkingDraftEditor } from "./PetitionWorkingDraftEditor";

import "./initiative-petition-stage-workspace.css";

interface PetitionEditingWorkspaceProps {
  readonly initiativeId: string;
  /** The published Petition this page shows; offered as the source of a new draft. */
  readonly currentPetitionId: string;
  /** Switches this page to the current Petition's Status view. */
  readonly onShowPetitionStatus?: () => void;
}

type LoadedLists = {
  readonly drafts: readonly PetitionWorkingDraft[];
  readonly published: readonly PublicPetitionRecord[];
};

/** HU-LC-05C.4C.7C.2 — data and actions behind {@link PetitionEditingWorkspacePanel}. */
export function PetitionEditingWorkspace({
  initiativeId,
  currentPetitionId,
  onShowPetitionStatus,
}: PetitionEditingWorkspaceProps) {
  const t = useTranslations("initiativeExperience");
  const [state, setState] = useState<PetitionEditingWorkspaceState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PetitionEditingNotice | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PetitionWorkingDraft | null>(null);

  /** A failed refresh keeps the lists already shown; only a first load can fail. */
  const load = useCallback(async (): Promise<LoadedLists | null> => {
    try {
      const [drafts, records] = await Promise.all([
        listPetitionWorkingDrafts(initiativeId),
        listReadablePetitions(),
      ]);
      const loaded = {
        drafts,
        published: selectInitiativePublishedPetitions(records, initiativeId),
      };
      setState({ status: "ready", ...loaded });
      setSelectedDraftId((current) =>
        current && drafts.some((draft) => draft.draftId === current) ? current : null,
      );
      return loaded;
    } catch (error) {
      const kind = classifyPetitionDraftError(error, { operation: "load" });
      setState((current) => (current.status === "ready" ? current : { status: "failed", kind }));
      setNotice({ tone: "error", text: t(`petitionEditing.errors.${kind}`) });
      return null;
    }
  }, [initiativeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const slots =
    state.status === "ready"
      ? computePetitionSlotSummary({
          draftCount: state.drafts.length,
          publishedCount: state.published.length,
        })
      : null;

  async function handleCreate(derivedFromPetitionId: string | null) {
    setBusy(true);
    setNotice(null);

    try {
      const created = await createPetitionWorkingDraft(initiativeId, derivedFromPetitionId);
      await load();
      setSelectedDraftId(created.draftId);
      setNotice({
        tone: "success",
        text: t(
          derivedFromPetitionId
            ? "petitionEditing.messages.createdFromPetition"
            : "petitionEditing.messages.created",
        ),
      });
    } catch (error) {
      const fresh = await load();
      const kind = classifyPetitionDraftError(error, {
        operation: derivedFromPetitionId ? "createDerived" : "create",
        slotsAvailable: fresh
          ? computePetitionSlotSummary({
              draftCount: fresh.drafts.length,
              publishedCount: fresh.published.length,
            }).available
          : undefined,
      });
      setNotice({ tone: "error", text: t(`petitionEditing.errors.${kind}`) });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const { draftId } = pendingDelete;
    setBusy(true);
    setNotice(null);

    try {
      await deletePetitionWorkingDraft(initiativeId, draftId);
      setPendingDelete(null);
      if (selectedDraftId === draftId) {
        setSelectedDraftId(null);
      }
      await load();
      setNotice({ tone: "success", text: t("petitionEditing.messages.deleted") });
    } catch (error) {
      const kind = classifyPetitionDraftError(error, { operation: "delete" });
      setPendingDelete(null);
      setNotice({ tone: "error", text: t(`petitionEditing.errors.${kind}`) });
      if (petitionDraftErrorRequiresReload(kind)) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDraftUpdated(updated: PetitionWorkingDraft) {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            drafts: current.drafts.map((draft) =>
              draft.draftId === updated.draftId ? updated : draft,
            ),
          }
        : current,
    );
  }

  function handleEditorError(kind: PetitionDraftErrorKind) {
    if (petitionDraftErrorRequiresReload(kind)) {
      void load();
    }
  }

  function handlePublished(petition: Petition) {
    setSelectedDraftId(null);
    setNotice({
      tone: "success",
      text: t("petitionEditing.messages.published"),
      publishedPetitionId: petition.petitionId,
    });
    void load();
  }

  const selectedDraft =
    state.status === "ready"
      ? (state.drafts.find((draft) => draft.draftId === selectedDraftId) ?? null)
      : null;

  return (
    <PetitionEditingWorkspacePanel
      currentPetitionId={currentPetitionId}
      state={state}
      slots={slots}
      busy={busy}
      notice={notice}
      selectedDraftId={selectedDraft?.draftId ?? null}
      pendingDelete={pendingDelete}
      editor={
        selectedDraft ? (
          <PetitionWorkingDraftEditor
            key={selectedDraft.draftId}
            initiativeId={initiativeId}
            draft={selectedDraft}
            onDraftUpdated={handleDraftUpdated}
            onPublished={handlePublished}
            onError={handleEditorError}
            onClose={() => setSelectedDraftId(null)}
          />
        ) : null
      }
      onCreateEmpty={() => void handleCreate(null)}
      onCreateFromCurrent={() => void handleCreate(currentPetitionId)}
      onRefresh={() => {
        setNotice(null);
        void load();
      }}
      onSelectDraft={(draftId) => {
        setNotice(null);
        setSelectedDraftId(draftId);
      }}
      onRequestDelete={setPendingDelete}
      onCancelDelete={() => setPendingDelete(null)}
      onConfirmDelete={() => void handleConfirmDelete()}
      onShowPetitionStatus={onShowPetitionStatus}
    />
  );
}
