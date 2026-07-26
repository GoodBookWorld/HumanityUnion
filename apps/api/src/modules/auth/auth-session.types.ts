/** Mongo-backed refresh session record — never expose outside auth infrastructure. */
export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
  userAgent?: string;
}

export interface CreateAuthSessionInput {
  sessionId?: string;
  userId: string;
  refreshToken: string;
  expiresAt: string;
  userAgent?: string;
}
