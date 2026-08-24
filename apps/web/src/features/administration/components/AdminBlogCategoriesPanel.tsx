"use client";

import { useCallback, useEffect, useId, useState } from "react";

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
  updateAdminBlogCategory,
} from "../admin-publishing-api";

/**
 * Pack 16F — Admin Publication Categories management.
 * Stable categoryId is identity; display name is never the canonical key.
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
      setMessage("Category deactivated. Existing posts keep this category; it cannot be selected for new publications.");
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

  return (
    <div className="admin-blog-categories">
      <p className="hu-caption">
        Manage publication categories. The stable category ID is the identity — never the display
        name. Inactive categories stay on historical posts but cannot be selected for new
        publications. Public dropdown and chart list active categories; inactive deep links still
        filter historical posts.
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

      <ul className="admin-blog-categories__list">
        {categories.map((row) => (
          <li key={row.categoryId} className="admin-blog-categories__item">
            {editingId === row.categoryId ? (
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
                  Slug
                  <input
                    className="hu-form-control"
                    value={editSlug}
                    onChange={(event) => setEditSlug(event.target.value)}
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
              </div>
            ) : (
              <>
                <p className="hu-heading-4">{row.name}</p>
                <p className="hu-caption">
                  ID: {row.categoryId} · slug: {row.slug} · {row.status} ·{" "}
                  {row.publicationCount} publication{row.publicationCount === 1 ? "" : "s"}
                </p>
                {row.description ? <p className="hu-body">{row.description}</p> : null}
                <div className="hu-form-actions">
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
                </div>
                <div className="admin-blog-categories__delete">
                  {row.publicationCount > 0 ? (
                    <>
                      <label className="hu-label">
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
                                entry.categoryId !== row.categoryId && entry.status === "active",
                            )
                            .map((entry) => (
                              <option key={entry.categoryId} value={entry.categoryId}>
                                {entry.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <HelperText>
                        Destructive delete is blocked until publications are reassigned.
                      </HelperText>
                    </>
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
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
