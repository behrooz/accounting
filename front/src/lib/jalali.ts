import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

/** API date (YYYY-MM-DD Gregorian) → Shamsi display string with Persian digits. */
export function gregorianISOToJalali(iso: string, format = "YYYY/MM/DD") {
  if (!iso) return "";
  try {
    const d = new DateObject({
      date: iso,
      format: "YYYY-MM-DD",
      calendar: gregorian,
    }).convert(persian, persian_fa);
    return d.isValid ? d.format(format) : "";
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
  if (!iso) return undefined;
  try {
    const d = new DateObject({
      date: iso,
      format: "YYYY-MM-DD",
      calendar: gregorian,
    }).convert(persian, persian_fa);
    return d.isValid ? d : undefined;
  } catch {
    return undefined;
  }
}
