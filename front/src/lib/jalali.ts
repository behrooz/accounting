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
 * DatePicker selection → API YYYY-MM-DD (Gregorian, ASCII digits).
 * Returns "" if the value is incomplete / invalid so filters are not applied wrongly.
 */
export function jalaliToGregorianISO(
  dateObj: DateObject | DateObject[] | null | undefined,
): string {
  if (!dateObj || Array.isArray(dateObj)) return "";
  try {
    // toDate() yields a real JS Date in local time — avoids Persian-digit format issues
    const js = new DateObject(dateObj).toDate();
    if (Number.isNaN(js.getTime())) return "";
    const year = js.getFullYear();
    const month = js.getMonth() + 1;
    const day = js.getDate();
    if (year < 1900 || year > 2100) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
