/**
 * HYD-01A/HYD-01B — calendar date text that is identical on the server (Node)
 * and in every browser.
 *
 * Dates are formatted in UTC (calendar dates are stored as UTC midnight).
 * Georgian is spelled out from CLDR 48 month names because some browsers ship
 * no Georgian date data and fall back to English, which broke hydration.
 *
 * Self-contained (no module-level references) so tests can run the exact
 * implementation inside a browser.
 */
export function formatUtcCalendarDate(locale: string, date: Date, month: "long" | "short"): string {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0];
  if (language === "ka") {
    // CLDR 48 `ka` patterns: long "d MMMM, y", short "d MMM. y".
    const long = [
      "იანვარი",
      "თებერვალი",
      "მარტი",
      "აპრილი",
      "მაისი",
      "ივნისი",
      "ივლისი",
      "აგვისტო",
      "სექტემბერი",
      "ოქტომბერი",
      "ნოემბერი",
      "დეკემბერი",
    ];
    const short = [
      "იან",
      "თებ",
      "მარ",
      "აპრ",
      "მაი",
      "ივნ",
      "ივლ",
      "აგვ",
      "სექ",
      "ოქტ",
      "ნოე",
      "დეკ",
    ];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    const index = date.getUTCMonth();
    return month === "long" ? `${day} ${long[index]}, ${year}` : `${day} ${short[index]}. ${year}`;
  }
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month,
    day: "numeric",
    timeZone: "UTC",
  });
}
