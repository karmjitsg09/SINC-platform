import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes fresh
        gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
        refetchOnWindowFocus: false, // Prevents sudden flashes or duplicate requests on focus
        retry: 1
      },
      mutations: {
        retry: 1
      }
    }
  });
}

// Singleton QueryClient instance for client-side execution
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a fresh QueryClient per request
    return createQueryClient();
  } else {
    // Browser: reuse the same client across renders
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}

export const queryClient = getQueryClient();
