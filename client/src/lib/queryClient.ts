import { QueryClient, QueryFunction } from "@tanstack/react-query";

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken?: () => Promise<string | null>;
      };
    };
  }
}

export async function getClerkToken() {
  try {
    return (await window.Clerk?.session?.getToken?.()) ?? null;
  } catch (error) {
    console.error("[getClerkToken] Failed to read Clerk token", error);
    return null;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await res.json();
        
        // Prioritize message field
        if (errorData.message) {
          errorMessage = errorData.message;
        } 
        // Handle Zod validation errors
        else if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map((e: any) => {
            if (typeof e === 'string') return e;
            const path = e.path?.join('.') || e.path || 'field';
            const msg = e.message || 'invalid';
            return `${path}: ${msg}`;
          });
          errorMessage = errorMessages.join(', ');
        }
        // Handle details object (from Zod format())
        else if (errorData.details) {
          const detailMessages: string[] = [];
          for (const [key, value] of Object.entries(errorData.details)) {
            if (value && typeof value === 'object' && '_errors' in value) {
              const errors = (value as any)._errors;
              if (Array.isArray(errors) && errors.length > 0) {
                detailMessages.push(`${key}: ${errors.join(', ')}`);
              }
            }
          }
          if (detailMessages.length > 0) {
            errorMessage = detailMessages.join('; ');
          }
        }
        // Fallback to error field
        else if (errorData.error) {
          errorMessage = typeof errorData.error === 'string' 
            ? errorData.error 
            : String(errorData.error);
        }
      } else {
        const text = await res.text();
        if (text) errorMessage = text;
      }
    } catch (e) {
      // If parsing fails, use status text
      console.error("Error parsing error response:", e);
    }
    
    // Provide more context for common error codes
    if (res.status === 400 && errorMessage === "Bad Request") {
      errorMessage = "Invalid request data. Please check your input and try again.";
    } else if (res.status === 409) {
      errorMessage = errorMessage || "This time slot is already booked. Please select a different time.";
    } else if (res.status === 500) {
      errorMessage = errorMessage || "Server error. Please try again later.";
    }
    
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    (error as any).response = res;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = await getClerkToken();
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getClerkToken();
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
