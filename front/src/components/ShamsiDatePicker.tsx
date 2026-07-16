"use client";

import DatePicker, { type DatePickerProps } from "react-multi-date-picker";
import type DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import {
  isoToPersianDateObject,
  jalaliToGregorianISO,
} from "@/lib/jalali";

type Props = {
  /** Controlled value as Gregorian YYYY-MM-DD (API format), or "" */
  value: string;
  onChange: (iso: string) => void;
  inputClassName?: string;
  placeholder?: string;
  id?: string;
};

/**
 * Shamsi (Jalali) date picker with Persian digits.
 * Stores/returns Gregorian YYYY-MM-DD for the API.
 * Do not wrap this in a <label> — that breaks day clicks.
 */
export default function ShamsiDatePicker({
  value,
  onChange,
  inputClassName,
  placeholder = "انتخاب تاریخ",
  id,
}: Props) {
  const handleChange: DatePickerProps["onChange"] = (d) => {
    if (!d) {
      onChange("");
      return;
    }
    const iso = jalaliToGregorianISO(d as DateObject);
    // Ignore incomplete picks (typing / month nav) — don't clear or set bad filters
    if (!iso) return;
    onChange(iso);
  };

  return (
    <DatePicker
      id={id}
      calendar={persian}
      locale={persian_fa}
      format="YYYY/MM/DD"
      calendarPosition="bottom-right"
      portal
      zIndex={2000}
      value={value ? isoToPersianDateObject(value) : undefined}
      onChange={handleChange}
      placeholder={placeholder}
      inputClass={inputClassName}
      containerStyle={{ width: "100%", display: "block" }}
      style={{ width: "100%", boxSizing: "border-box" }}
    />
  );
}
