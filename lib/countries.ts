import { COUNTRY_CODES, COUNTRY_NAMES } from "./country-codes";

export const isCountryCode = (c: unknown): c is string =>
  typeof c === "string" && /^[A-Za-z]{2}$/.test(c) && COUNTRY_CODES.includes(c.toUpperCase());

export function normalizeCountryCode(c: unknown): string | null {
  return isCountryCode(c) ? (c as string).toUpperCase() : null;
}

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase();
}

export function flagSrc(code: string): string {
  return `/flags/${code.toLowerCase()}.svg`;
}

export function allCountries(): { code: string; name: string }[] {
  // COUNTRY_CODES is already sorted by name at generation time (a runtime locale sort would differ between server and browser)
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }));
}

/** Legacy data stored a country *name*. Map it to a code; unknown names return null (never guessed). */
const ALIASES: Record<string, string> = { turkey: "TR", türkiye: "TR", turkiye: "TR", "hong kong": "HK", uae: "AE", usa: "US", uk: "GB" };
export function countryCodeFromName(name: string): string | null {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  if (ALIASES[n]) return ALIASES[n];
  if (isCountryCode(n)) return n.toUpperCase();
  for (const code of COUNTRY_CODES) if (countryName(code).toLowerCase() === n) return code;
  for (const code of COUNTRY_CODES) if (countryName(code).toLowerCase().startsWith(n)) return code;
  return null;
}
