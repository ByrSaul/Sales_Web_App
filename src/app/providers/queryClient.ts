import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../../core/api/errors';
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: (count, error) => error instanceof ApiError && error.status !== undefined && error.status < 500 ? false : count < 2, refetchOnWindowFocus: false } } });
