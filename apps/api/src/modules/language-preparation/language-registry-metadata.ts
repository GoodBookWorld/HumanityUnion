/**
 * Resolve Registry locale metadata for offline language preparation.
 * No locale-specific defaults. Fail clearly when Registry is unavailable
 * and the operator did not supply metadata flags.
 */

export type LanguagePreparationTextDirection = "ltr" | "rtl";

export type LanguagePreparationLocaleMetadata = {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguagePreparationTextDirection;
  readonly source: "registry" | "cli";
};

export class LanguagePreparationMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguagePreparationMetadataError";
  }
}

export async function resolveLanguagePreparationLocaleMetadata(input: {
  readonly locale: string;
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: string;
  readonly resolveRegistryLocale?: (
    locale: string,
  ) => Promise<{
    readonly locale: string;
    readonly englishName: string;
    readonly nativeName: string;
    readonly textDirection: string;
  } | null>;
}): Promise<LanguagePreparationLocaleMetadata> {
  const hasCli =
    Boolean(input.englishName?.trim()) &&
    Boolean(input.nativeName?.trim()) &&
    (input.textDirection === "ltr" || input.textDirection === "rtl");

  if (hasCli) {
    return {
      locale: input.locale,
      englishName: input.englishName!.trim(),
      nativeName: input.nativeName!.trim(),
      textDirection: input.textDirection as LanguagePreparationTextDirection,
      source: "cli",
    };
  }

  const resolve =
    input.resolveRegistryLocale ??
    (async (locale: string) => {
      const module = await import("../language/language-registry/language-registry.repository.js");
      return module.resolveLanguageRegistryLocale(locale);
    });

  let record: {
    readonly locale: string;
    readonly englishName: string;
    readonly nativeName: string;
    readonly textDirection: string;
  } | null = null;
  try {
    record = await resolve(input.locale);
  } catch (error) {
    throw new LanguagePreparationMetadataError(
      `Registry metadata unavailable for locale "${input.locale}". Pass --english-name, --native-name, and --text-direction, or restore Registry access. (${error instanceof Error ? error.message : "lookup failed"})`,
    );
  }
  if (!record) {
    throw new LanguagePreparationMetadataError(
      `Locale "${input.locale}" is not in the Language Registry. Register it first, or pass --english-name, --native-name, and --text-direction.`,
    );
  }
  if (record.textDirection !== "ltr" && record.textDirection !== "rtl") {
    throw new LanguagePreparationMetadataError(
      `Registry textDirection for "${input.locale}" must be ltr or rtl.`,
    );
  }
  return {
    locale: record.locale,
    englishName: record.englishName.trim(),
    nativeName: record.nativeName.trim(),
    textDirection: record.textDirection,
    source: "registry",
  };
}
