const API_BASE_URL = "http://localhost:4000";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  links: Record<string, unknown>;
  message: string;
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      ...options,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`API request failed: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new Error(body.message || "API request failed");
  }

  return body.data;
}
