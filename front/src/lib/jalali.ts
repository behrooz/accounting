import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

/** Normalize API/DB date strings to YYYY-MM-DD (Gregorian). */
export function normalizeGregorianISO(input: string): string {
  if (!input) return "";
  const s = String(input).trim();
  // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss... or YYYY-MM-DD HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

function localDateFromISO(iso: string): Date | null {
  const norm = normalizeGregorianISO(iso);
  if (!norm) return null;
  const [y, m, d] = norm.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** API date (YYYY-MM-DD Gregorian, optionally with time) → Shamsi with Persian digits. */
export function gregorianISOToJalali(iso: string, format = "YYYY/MM/DD") {
  if (!iso) return "";
  const norm = normalizeGregorianISO(iso);
  if (!norm) return "";

  try {
    const d = new DateObject({
      date: norm,
      format: "YYYY-MM-DD",
      calendar: gregorian,
    }).convert(persian, persian_fa);
    if (d.isValid) return d.format(format);
  } catch {
    // fall through
  }

  // Fallback: browser Intl (still Shamsi + Persian digits via fa-IR)
  const dt = localDateFromISO(norm);
  if (!dt) return "";
  try {
    return dt.toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

/**
 * DatePicker selection → API YYYY-MM-DD (Gregorian).
 * Returns "" if the value is incomplete / invalid so filters are not applied wrongly.
 */
export function jalaliToGregorianISO(
  dateObj: DateObject | DateObject[] | null | undefined,
): string {
  if (!dateObj || Array.isArray(dateObj)) return "";
  try {
    const d = new DateObject(dateObj).convert(gregorian);
    if (!d.isValid) return "";
    const out = d.format("YYYY-MM-DD");
    // Guard against accidental Jalali year leaking into ISO (e.g. 1405-04-25)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) return "";
    const year = Number(out.slice(0, 4));
    if (year < 1900 || year > 2100) return "";
    return out;
  } catch {
    return "";
  }
}

/** Controlled DatePicker value from API ISO date. */
export function isoToPersianDateObject(iso: string): DateObject | undefined {
  const norm = normalizeGregorianISO(iso);
  if (!norm) return undefined;
  try {
    const d = new DateObject({
      date: norm,
      format: "YYYY-MM-DD",
      calendar: gregorian,
    }).convert(persian, persian_fa);
    return d.isValid ? d : undefined;
  } catch {
    return undefined;
  }
}
