import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid, parse } from "date-fns"
import type { DateFormat } from "@/hooks/useDateFormat"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const parsePostgresTimestamp = (value: string) => {
  const formats = [
    "yyyy-MM-dd HH:mm:ss.SSSxxx",
    "yyyy-MM-dd HH:mm:ss.SSSxx",
    "yyyy-MM-dd HH:mm:ss.SSSx",
    "yyyy-MM-dd HH:mm:ss.SSSX",
    "yyyy-MM-dd HH:mm:ssxxx",
    "yyyy-MM-dd HH:mm:ssxx",
    "yyyy-MM-dd HH:mm:ssx",
    "yyyy-MM-dd HH:mm:ssX",
    "yyyy-MM-dd HH:mm:ss.SSS",
    "yyyy-MM-dd HH:mm:ss",
  ]
  for (const fmt of formats) {
    const parsed = parse(value, fmt, new Date())
    if (isValid(parsed)) {
      return parsed
    }
  }
  return null
}

const normalizePostgresTimestamp = (value: string) => {
  const trimmed = value.trim()
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?(?:\s*)?(Z|[+-]\d{2}(?::?\d{2})?)?$/
  )
  if (!match) {
    return null
  }
  const datePart = match[1]
  const timePart = match[2]
  const fractional = match[3]
  const timezone = match[4]

  let msPart = ""
  if (fractional) {
    const raw = fractional.slice(1)
    const normalized = raw.padEnd(3, "0").slice(0, 3)
    msPart = `.${normalized}`
  }

  let iso = `${datePart}T${timePart}${msPart}`
  if (timezone) {
    if (timezone === "Z") {
      iso += "Z"
    } else {
      const tzMatch = timezone.match(/^([+-]\d{2})(?::?(\d{2}))?$/)
      if (tzMatch) {
        iso += `${tzMatch[1]}:${tzMatch[2] ?? "00"}`
      }
    }
  }

  return iso
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
    if (trimmed.includes(":")) {
      const dateTime = parseDateTime(trimmed)
      if (dateTime) {
        return dateTime
      }
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
    const trimmed = date.trim()
    if (/^\d+$/.test(trimmed)) {
      const numeric = new Date(Number(trimmed))
      return isValid(numeric) ? numeric : null
    }
    const normalizedPostgres = normalizePostgresTimestamp(trimmed)
    if (normalizedPostgres) {
      const normalizedParsed = parseISO(normalizedPostgres)
      if (isValid(normalizedParsed)) {
        return normalizedParsed
      }
    }
    const isoParsed = parseISO(trimmed)
    if (isValid(isoParsed)) {
      return isoParsed
    }
    const dateObj = new Date(trimmed)
    if (isValid(dateObj)) {
      return dateObj
    }
    if (trimmed.includes(" ") && !trimmed.includes("T")) {
      const isoCandidate = trimmed.replace(" ", "T")
      const isoCandidateParsed = parseISO(isoCandidate)
      if (isValid(isoCandidateParsed)) {
        return isoCandidateParsed
      }
    }
    const postgresParsed = parsePostgresTimestamp(trimmed)
    if (postgresParsed) {
      return postgresParsed
    }
    const normalizedDatePart = trimmed.split("T")[0].split(" ")[0]
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
  console.log("[formatDisplayDate] input:", date)
  const formatStr = dateFormat || "dd-MMM-yyyy"
  const dateObj = parseDateOnly(date)
  if (!dateObj) {
    console.log("[formatDisplayDate] failed to parse:", date)
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
  console.log("[formatDisplayDateTime] input:", date)
  const formatStr = dateFormat || "dd-MMM-yyyy"
  const dateObj = parseDateTime(date)
  if (!dateObj) {
    console.log("[formatDisplayDateTime] failed to parse:", date)
    return ""
  }
  return format(dateObj, `${formatStr} HH:mm`)
}
