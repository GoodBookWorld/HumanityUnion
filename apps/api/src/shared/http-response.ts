export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
  links: Record<string, unknown>;
  message: string;
}

export function createSuccessResponse<T>(
  data: T,
  message = "",
  meta: Record<string, unknown> = {},
  links: Record<string, unknown> = {},
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
    links,
    message,
  };
}
