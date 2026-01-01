import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"
import type { DateFormat } from "@/hooks/useDateFormat"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date consistently across the app
 * @param date - Date object or date string
 * @param dateFormat - Optional date format. If not provided, defaults to dd-MMM-yyyy
 * @returns Formatted date string
 */
export function formatDisplayDate(date: Date | string, dateFormat?: DateFormat): string {
  const dateObj = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
  const formatStr = dateFormat || 'dd-MMM-yyyy';
  return format(dateObj, formatStr);
}
