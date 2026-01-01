import { formatDisplayDate } from "@/lib/utils";
import { useDateFormat } from "./useDateFormat";

/**
 * Hook that returns a formatted date function using the user's preferred date format
 */
export function useFormattedDate() {
  const dateFormat = useDateFormat();
  
  return (date: Date | string) => formatDisplayDate(date, dateFormat);
}
