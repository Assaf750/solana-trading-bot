// Types for router.mjs (read-only management API skeleton).

export interface ApiRequest {
  method?: string;
  path?: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export function handleRequest(req?: ApiRequest): ApiResponse;
export const READ_ONLY_ROUTES: readonly string[];
export const ROUTE_RESOURCE_TYPES: Readonly<Record<string, string>>;
