import { formatDisplayDateTime } from "@/lib/utils"
import { useDateFormat } from "./useDateFormat"

/**
 * Hook that returns a formatted date-time function using the user's preferred date format
 */
export function useFormattedDateTime() {
  const dateFormat = useDateFormat()

  return (date: Date | string) => formatDisplayDateTime(date, dateFormat)
}
