import type { AdminAuditCategory } from "@hu/types";

export const ADMIN_AUDIT_CATEGORY_OPTIONS: readonly {
  value: AdminAuditCategory | "";
  label: string;
}[] = [
  { value: "", label: "All categories" },
  { value: "initiatives", label: "Initiatives" },
  { value: "publishing", label: "Publishing" },
  { value: "subscribers", label: "Subscribers" },
  { value: "seo", label: "SEO" },
  { value: "beta_access", label: "Beta Access" },
  { value: "platform", label: "Platform" },
  { value: "public_choice", label: "Public Choice" },
  { value: "administration", label: "Administration" },
  { value: "participants", label: "Participants" },
  { value: "membership", label: "Membership" },
  { value: "other", label: "Other" },
] as const;

export function formatAdminAuditCategoryLabel(category: AdminAuditCategory): string {
  const found = ADMIN_AUDIT_CATEGORY_OPTIONS.find((option) => option.value === category);
  return found?.label ?? category;
}

export function formatAdminAuditDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
