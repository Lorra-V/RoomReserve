import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"
import type { DateFormat } from "@/hooks/useDateFormat"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const parseDateOnly = (date: Date | string) => {
  if (typeof date === "string") {
    const normalizedDatePart = date.split("T")[0].split(" ")[0]
    const dateObj = parseISO(normalizedDatePart)
    if (isValid(dateObj)) {
      return dateObj
    }
    const fallback = new Date(date)
    return isValid(fallback) ? fallback : null
  }

  return isValid(date) ? date : null
}

const parseDateTime = (date: Date | string) => {
  if (typeof date === "string") {
    const dateObj = new Date(date)
    if (isValid(dateObj)) {
      return dateObj
    }
    const normalizedDatePart = date.split("T")[0].split(" ")[0]
    const fallback = parseISO(normalizedDatePart)
    return isValid(fallback) ? fallback : null
  }

  return isValid(date) ? date : null
}

/**
 * Formats a date consistently across the app
 * @param date - Date object or date string
 * @param dateFormat - Optional date format. If not provided, defaults to dd-MMM-yyyy
 * @returns Formatted date string
 */
export function formatDisplayDate(date: Date | string, dateFormat?: DateFormat): string {
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
export function formatDisplayDateTime(date: Date | string, dateFormat?: DateFormat): string {
  const formatStr = dateFormat || "dd-MMM-yyyy"
  const dateObj = parseDateTime(date)
  if (!dateObj) {
    return ""
  }
  return format(dateObj, `${formatStr} HH:mm`)
}
