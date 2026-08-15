import {
  isAuthRefreshExemptPath,
  refreshAuthSessionOnce,
} from "../features/auth/auth-token-refresh";
import { clearLegacyAuthTokenStorage } from "../features/auth/auth-token-store";
import { API_BASE_URL } from "./api-base-url";

export { API_BASE_URL };

const API_UNAVAILABLE_MESSAGE =
  "The Humanity Union service is temporarily unavailable. Please check that the API is running and try again.";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  links: Record<string, unknown>;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(message: string, status: number, meta?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.meta = meta;
  }
}

/**
 * Launch Readiness Pack 07 — browser auth uses HttpOnly cookies via
 * `credentials: "include"`. Do not construct Authorization from Web Storage.
 */
async function readApiEnvelope<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === 204) {
    return {
      success: response.ok,
      data: {} as T,
      meta: {},
      links: {},
      message: "",
    };
  }

  const text = await response.text();

  if (!text.trim()) {
    if (response.ok) {
      return {
        success: true,
        data: {} as T,
        meta: {},
        links: {},
        message: "",
      };
    }

    throw new ApiRequestError(API_UNAVAILABLE_MESSAGE, response.status);
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      "The Humanity Union service returned an unexpected response. Please try again shortly.",
      response.status,
    );
  }
}

function shouldAttemptRefresh(path: string, isRetry: boolean): boolean {
  // Auth Recovery Hotfix — at most one refresh + one retry per request.
  // /auth/refresh (and other auth bootstrap paths) never recurse into refresh.
  if (isRetry || isAuthRefreshExemptPath(path)) {
    return false;
  }

  return true;
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return executeApiRequest<T>(path, options, false);
}

/**
 * Bound: original request → optional single refresh → optional single retry.
 * Never: request → refresh → retry → refresh → …
 */
async function executeApiRequest<T>(
  path: string,
  options: RequestInit | undefined,
  isRetry: boolean,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      credentials: "include",
      ...options,
      headers: options?.headers,
    });
  } catch {
    throw new ApiRequestError(API_UNAVAILABLE_MESSAGE, 0);
  }

  if (response.status === 401 && shouldAttemptRefresh(path, isRetry)) {
    const refreshed = await refreshAuthSessionOnce();

    if (refreshed) {
      return executeApiRequest<T>(path, options, true);
    }

    clearLegacyAuthTokenStorage();
  }

  const body = await readApiEnvelope<T>(response);

  if (!response.ok || !body.success) {
    throw new ApiRequestError(
      body.message || `API request failed: ${response.status}`,
      response.status,
      body.meta,
    );
  }

  return body.data;
}

export function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 403;
}

export async function apiRequestOptional<T>(
  path: string,
  options?: RequestInit,
): Promise<T | null> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export function isApiUnavailableError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.status === 0 || error.status >= 500;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

export function formatAuthFormError(error: unknown): string {
  if (isApiUnavailableError(error)) {
    return API_UNAVAILABLE_MESSAGE;
  }

  if (error instanceof ApiRequestError) {
    // Launch Blocker Recovery Pack 01 — origin/CORS misconfiguration must not
    // look like an invalid password.
    if (error.meta?.code === "AUTH_ORIGIN_FORBIDDEN") {
      return "We couldn't start your session. Please try again.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export interface PublicInitiativeListResult<TItem, TMetrics> {
  items: TItem[];
  metrics: TMetrics;
}

export async function fetchPublicInitiativeList<TItem, TMetrics>(
  path: string,
  defaultMetrics: TMetrics,
): Promise<PublicInitiativeListResult<TItem, TMetrics>> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ApiRequestError(API_UNAVAILABLE_MESSAGE, 0);
  }

  if (response.status === 404) {
    return { items: [], metrics: defaultMetrics };
  }

  const payload = await readApiEnvelope<TItem[]>(response);

  if (!response.ok || !payload.success) {
    if (response.status === 404) {
      return { items: [], metrics: defaultMetrics };
    }

    throw new ApiRequestError(
      payload.message || `API request failed: ${response.status}`,
      response.status,
      payload.meta,
    );
  }

  return {
    items: payload.data,
    metrics: (payload.meta?.metrics as TMetrics | undefined) ?? defaultMetrics,
  };
}
