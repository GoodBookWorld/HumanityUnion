"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { AdminBlogCategoryItem } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  activateAdminBlogCategory,
  createAdminBlogCategory,
  deactivateAdminBlogCategory,
  deleteAdminBlogCategory,
  listAdminBlogCategories,
  reorderAdminBlogCategories,
  updateAdminBlogCategory,
} from "../admin-publishing-api";
import {
  moveCategoryIdInOrder,
  moveCategoryIndexInOrder,
} from "../blog-category-reorder";

/**
 * Pack 16F / 20C — Admin Publication Categories management.
 * Stable categoryId is identity; sortOrder is display priority.
 */
export function AdminBlogCategoriesPanel() {
  const nameId = useId();
  const slugId = useId();
  const descriptionId = useId();
  const [categories, setCategories] = useState<readonly AdminBlogCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [reassignTo, setReassignTo] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const categoriesRef = useRef(categories);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminBlogCategories();
      setCategories(result.categories);
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistOrder(
    orderedCategoryIds: readonly string[],
    previous: readonly AdminBlogCategoryItem[],
  ): Promise<boolean> {
    setBusyId("reorder");
    setMessage(null);
    setError(null);
    try {
      const result = await reorderAdminBlogCategories({ orderedCategoryIds });
      setCategories(result.categories);
      setMessage("Category order saved.");
      return true;
    } catch (err: unknown) {
      setCategories(previous);
      setError(formatAuthFormError(err));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    setBusyId("create");
    setMessage(null);
    setError(null);
    try {
      await createAdminBlogCategory({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setName("");
      setSlug("");
      setDescription("");
      setMessage("Category created.");
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit(categoryId: string) {
    setBusyId(categoryId);
    setMessage(null);
    setError(null);
    try {
      await updateAdminBlogCategory(categoryId, {
        name: editName.trim(),
        slug: editSlug.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      setMessage("Category updated.");
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(categoryId: string) {
    setBusyId(categoryId);
    setError(null);
    try {
      await activateAdminBlogCategory(categoryId);
      setMessage("Category activated.");
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(categoryId: string) {
    setBusyId(categoryId);
    setError(null);
    try {
      await deactivateAdminBlogCategory(categoryId);
      setMessage(
        "Category deactivated. Existing posts keep this category; it cannot be selected for new publications.",
      );
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AdminBlogCategoryItem) {
    setBusyId(row.categoryId);
    setError(null);
    try {
      const target = reassignTo[row.categoryId]?.trim();
      await deleteAdminBlogCategory(row.categoryId, {
        reassignToCategoryId: row.publicationCount > 0 ? target : undefined,
      });
      setMessage(
        row.publicationCount > 0
          ? `Category deleted after reassigning ${row.publicationCount} publication(s).`
          : "Category deleted.",
      );
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(categoryId: string, direction: "up" | "down") {
    const previous = categoriesRef.current;
    const orderedCategoryIds = moveCategoryIdInOrder(
      previous.map((row) => row.categoryId),
      categoryId,
      direction,
    );
    if (orderedCategoryIds.every((id, index) => id === previous[index]?.categoryId)) {
      return;
    }
    const optimistic = orderedCategoryIds
      .map((id) => previous.find((row) => row.categoryId === id))
      .filter((row): row is AdminBlogCategoryItem => Boolean(row));
    setCategories(optimistic);
    await persistOrder(orderedCategoryIds, previous);
  }

  async function handleDrop(targetCategoryId: string) {
    if (!draggingId || draggingId === targetCategoryId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const previous = categoriesRef.current;
    const fromIndex = previous.findIndex((row) => row.categoryId === draggingId);
    const toIndex = previous.findIndex((row) => row.categoryId === targetCategoryId);
    setDraggingId(null);
    setDragOverId(null);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const orderedCategoryIds = moveCategoryIndexInOrder(
      previous.map((row) => row.categoryId),
      fromIndex,
      toIndex,
    );
    const optimistic = orderedCategoryIds
      .map((id) => previous.find((row) => row.categoryId === id))
      .filter((row): row is AdminBlogCategoryItem => Boolean(row));
    setCategories(optimistic);
    await persistOrder(orderedCategoryIds, previous);
  }

  return (
    <div className="admin-blog-categories">
      <p className="hu-caption">
        Manage publication categories. The stable category ID is the identity — never the display
        name. Drag rows (or use Move up/down) to set public and authoring display priority. Inactive
        categories stay on historical posts but cannot be selected for new publications.
      </p>
      {error ? <StatusBanner title="Categories unavailable" message={error} /> : null}
      {message ? <StatusBanner title="Categories" message={message} /> : null}

      <section className="admin-blog-categories__create" aria-labelledby="admin-cat-create">
        <h3 className="hu-heading-4" id="admin-cat-create">
          Create category
        </h3>
        <label className="hu-label" htmlFor={nameId}>
          Display name
        </label>
        <input
          id={nameId}
          className="hu-form-control"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
        <label className="hu-label" htmlFor={slugId}>
          Slug (optional)
        </label>
        <input
          id={slugId}
          className="hu-form-control"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="auto from name"
        />
        <label className="hu-label" htmlFor={descriptionId}>
          Description (optional)
        </label>
        <textarea
          id={descriptionId}
          className="hu-form-control"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
        <Button
          type="button"
          variant="primary"
          disabled={busyId !== null || name.trim().length < 2}
          onClick={() => {
            void handleCreate();
          }}
        >
          {busyId === "create" ? "Creating…" : "Create category"}
        </Button>
      </section>

      {loading ? <p className="hu-caption">Loading categories…</p> : null}

      {!loading ? (
        <div className="admin-publishing-table-wrap admin-blog-categories__table-wrap">
          <table className="admin-publishing-table admin-blog-categories__table">
            <caption className="hu-visually-hidden">
              Publication categories ordered by display priority
            </caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Category</th>
                <th scope="col">Slug</th>
                <th scope="col">Status</th>
                <th scope="col">Publications</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row, index) => {
                const isEditing = editingId === row.categoryId;
                const rowClass = [
                  draggingId === row.categoryId ? "admin-blog-categories__row--dragging" : "",
                  dragOverId === row.categoryId ? "admin-blog-categories__row--drag-over" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr
                    key={row.categoryId}
                    className={rowClass || undefined}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverId(row.categoryId);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleDrop(row.categoryId);
                    }}
                  >
                    <td className="admin-blog-categories__order">
                      <span
                        className="admin-blog-categories__drag-handle"
                        draggable={busyId === null && !isEditing}
                        aria-grabbed={draggingId === row.categoryId}
                        aria-label={`Drag to reorder ${row.name}`}
                        title="Drag to reorder"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", row.categoryId);
                          setDraggingId(row.categoryId);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverId(null);
                        }}
                      >
                        ⋮⋮
                      </span>
                      <span className="admin-blog-categories__order-num">{index + 1}</span>
                      <span className="admin-blog-categories__move">
                        <button
                          type="button"
                          className="admin-blog-categories__move-btn"
                          aria-label={`Move ${row.name} up`}
                          disabled={busyId !== null || index === 0 || isEditing}
                          onClick={() => {
                            void handleMove(row.categoryId, "up");
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="admin-blog-categories__move-btn"
                          aria-label={`Move ${row.name} down`}
                          disabled={
                            busyId !== null || index === categories.length - 1 || isEditing
                          }
                          onClick={() => {
                            void handleMove(row.categoryId, "down");
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="admin-blog-categories__edit">
                          <label className="hu-label">
                            Display name
                            <input
                              className="hu-form-control"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                          </label>
                          <label className="hu-label">
                            Description
                            <textarea
                              className="hu-form-control"
                              rows={2}
                              value={editDescription}
                              onChange={(event) => setEditDescription(event.target.value)}
                            />
                          </label>
                          <HelperText>Category ID stays {row.categoryId} (not editable).</HelperText>
                        </div>
                      ) : (
                        <>
                          <strong>{row.name}</strong>
                          {row.description ? (
                            <p className="hu-caption admin-blog-categories__desc">{row.description}</p>
                          ) : null}
                          <p className="hu-caption">ID: {row.categoryId}</p>
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="hu-label">
                          Slug
                          <input
                            className="hu-form-control"
                            value={editSlug}
                            onChange={(event) => setEditSlug(event.target.value)}
                          />
                        </label>
                      ) : (
                        row.slug
                      )}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.publicationCount}</td>
                    <td>
                      {isEditing ? (
                        <div className="hu-form-actions">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={busyId !== null}
                            onClick={() => {
                              void handleSaveEdit(row.categoryId);
                            }}
                          >
                            Save
                          </Button>
                          <Button type="button" variant="tertiary" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="admin-blog-categories__actions">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busyId !== null}
                            onClick={() => {
                              setEditingId(row.categoryId);
                              setEditName(row.name);
                              setEditSlug(row.slug);
                              setEditDescription(row.description ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          {row.status === "active" ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busyId !== null}
                              onClick={() => {
                                void handleDeactivate(row.categoryId);
                              }}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busyId !== null}
                              onClick={() => {
                                void handleActivate(row.categoryId);
                              }}
                            >
                              Activate
                            </Button>
                          )}
                          {row.publicationCount > 0 ? (
                            <label className="hu-label admin-blog-categories__reassign">
                              Reassign publications before delete
                              <select
                                className="hu-form-control"
                                value={reassignTo[row.categoryId] ?? ""}
                                onChange={(event) =>
                                  setReassignTo((current) => ({
                                    ...current,
                                    [row.categoryId]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select active category…</option>
                                {categories
                                  .filter(
                                    (entry) =>
                                      entry.categoryId !== row.categoryId &&
                                      entry.status === "active",
                                  )
                                  .map((entry) => (
                                    <option key={entry.categoryId} value={entry.categoryId}>
                                      {entry.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          ) : null}
                          <Button
                            type="button"
                            variant="danger"
                            disabled={
                              busyId !== null ||
                              (row.publicationCount > 0 && !reassignTo[row.categoryId]?.trim())
                            }
                            onClick={() => {
                              void handleDelete(row);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
