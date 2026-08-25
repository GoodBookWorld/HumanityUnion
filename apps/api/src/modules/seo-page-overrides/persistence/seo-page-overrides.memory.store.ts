import type { SeoPageOverride, SeoPageOverrideFamily } from "@hu/types";

const memory = new Map<string, SeoPageOverride>();

export function getSeoPageOverrideMemory(pageId: string): SeoPageOverride | null {
  return memory.get(pageId) ?? null;
}

export function listSeoPageOverridesMemory(
  family?: SeoPageOverrideFamily,
): SeoPageOverride[] {
  const rows = [...memory.values()];
  if (!family) {
    return rows;
  }
  return rows.filter((row) => row.family === family);
}

export function upsertSeoPageOverrideMemory(override: SeoPageOverride): SeoPageOverride {
  memory.set(override.pageId, override);
  return override;
}

export function deleteSeoPageOverrideMemory(pageId: string): boolean {
  return memory.delete(pageId);
}

export function resetSeoPageOverridesMemoryForTests(): void {
  memory.clear();
}
