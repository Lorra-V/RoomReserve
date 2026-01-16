import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid, parse } from "date-fns"
import type { DateFormat } from "@/hooks/useDateFormat"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const parseDateOnly = (date: Date | string | number | null | undefined) => {
  if (date === null || date === undefined) {
    return null
  }
  if (date instanceof Date) {
    return isValid(date) ? date : null
  }
  if (typeof date === "number") {
    const numeric = new Date(date)
    return isValid(numeric) ? numeric : null
  }
  if (typeof date === "string") {
    const trimmed = date.trim()
    if (/^\d+$/.test(trimmed)) {
      const numeric = new Date(Number(trimmed))
      return isValid(numeric) ? numeric : null
    }
    const normalizedDatePart = date.split("T")[0].split(" ")[0]
    const dateObj = parseISO(normalizedDatePart)
    if (isValid(dateObj)) {
      return dateObj
    }
    const fallbackFormats: DateFormat[] = [
      "dd-MMM-yyyy",
      "MMM dd, yyyy",
      "dd/MM/yyyy",
      "MM/dd/yyyy",
      "yyyy-MM-dd",
    ]
    for (const fmt of fallbackFormats) {
      const parsed = parse(normalizedDatePart, fmt, new Date())
      if (isValid(parsed)) {
        return parsed
      }
    }
    const fallback = new Date(date)
    return isValid(fallback) ? fallback : null
  }

  return null
}

const parseDateTime = (date: Date | string | number | null | undefined) => {
  if (date === null || date === undefined) {
    return null
  }
  if (date instanceof Date) {
    return isValid(date) ? date : null
  }
  if (typeof date === "number") {
    const numeric = new Date(date)
    return isValid(numeric) ? numeric : null
  }
  if (typeof date === "string") {
    const dateObj = new Date(date)
    if (isValid(dateObj)) {
      return dateObj
    }
    const normalizedDatePart = date.split("T")[0].split(" ")[0]
    const fallback = parseISO(normalizedDatePart)
    return isValid(fallback) ? fallback : null
  }

  return null
}

/**
 * Formats a date consistently across the app
 * @param date - Date object or date string
 * @param dateFormat - Optional date format. If not provided, defaults to dd-MMM-yyyy
 * @returns Formatted date string
 */
export function formatDisplayDate(date: Date | string | number | null | undefined, dateFormat?: DateFormat): string {
  const formatStr = dateFormat || "dd-MMM-yyyy"
  const dateObj = parseDateOnly(date)
  if (!dateObj) {
    return ""
  }
  return format(dateObj, formatStr)
}

/**
 * Formats a date + time consistently across the app
 * @param date - Date object or date string
 * @param dateFormat - Optional date format. If not provided, defaults to dd-MMM-yyyy
 * @returns Formatted date/time string
 */
export function formatDisplayDateTime(date: Date | string | number | null | undefined, dateFormat?: DateFormat): string {
  const formatStr = dateFormat || "dd-MMM-yyyy"
  const dateObj = parseDateTime(date)
  if (!dateObj) {
    return ""
  }
  return format(dateObj, `${formatStr} HH:mm`)
}
