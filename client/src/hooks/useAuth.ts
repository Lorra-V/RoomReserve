import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
        });
        
        // 401 means not authenticated - return null instead of throwing
        if (res.status === 401) {
          return null;
        }
        
        if (!res.ok) {
          throw new Error(`Failed to fetch user: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (err) {
        console.error("[useAuth] Error fetching user:", err);
        // Return null on error to indicate not authenticated
        return null;
      }
    },
  });

  // Log for debugging
  if (error) {
    console.error("[useAuth] Query error:", error);
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    isSuperAdmin: user?.isSuperAdmin ?? false,
  };
}
