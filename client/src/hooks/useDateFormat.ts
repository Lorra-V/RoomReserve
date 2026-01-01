import { useAuth } from "./useAuth";

export type DateFormat = "dd-MMM-yyyy" | "MMM dd, yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";

/**
 * Hook to get the user's preferred date format, or default to dd-MMM-yyyy
 */
export function useDateFormat(): DateFormat {
  const { user } = useAuth();
  return (user?.dateFormat as DateFormat) || "dd-MMM-yyyy";
}
