import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

// Convert API date (YYYY-MM-DD, Gregorian) to Shamsi (Jalali) with Persian digits.
export function gregorianISOToJalali(iso: string, format = "YYYY/MM/DD") {
  if (!iso) return "";
  const d = new DateObject(iso);
  d.convert(persian, persian_fa);
  return d.format(format);
}

// Convert selected date from react-multi-date-picker (persian calendar) to
// API payload format (YYYY-MM-DD, Gregorian).
export function jalaliToGregorianISO(dateObj: DateObject) {
  // Use explicit Gregorian calendar for TS-safe conversion.
  const d = new DateObject(dateObj);
  d.convert(gregorian);
  return d.format("YYYY-MM-DD");
}

export function isoToLocalDate(iso: string) {
  // Prevent timezone shifts by forcing local midnight.
  // iso expected format: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

