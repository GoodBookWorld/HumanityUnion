/**
 * Raw PLATFORM_MODE values that identify a Humanity Union deployment.
 * Staging and production are isolated: a request is accepted only when its
 * signed target is exactly the raw mode. Mapped platform modes such as beta
 * and development are not deployment targets and fail closed.
 */
const INTEGRITY_MEDIA_DEPLOYMENT_TARGETS = ["staging", "production"] as const;

export type IntegrityMediaDeploymentTarget = (typeof INTEGRITY_MEDIA_DEPLOYMENT_TARGETS)[number];

export function readRawIntegrityMediaPlatformMode(env: NodeJS.ProcessEnv = process.env): string {
  return env.PLATFORM_MODE?.trim() ?? "";
}

export function isIntegrityMediaDeploymentTarget(
  value: string,
): value is IntegrityMediaDeploymentTarget {
  return (INTEGRITY_MEDIA_DEPLOYMENT_TARGETS as readonly string[]).includes(value);
}

/** The current deployment, or null when the mode is missing, unknown, or malformed. */
export function readIntegrityMediaDeploymentTarget(
  env: NodeJS.ProcessEnv = process.env,
): IntegrityMediaDeploymentTarget | null {
  const mode = readRawIntegrityMediaPlatformMode(env);
  return isIntegrityMediaDeploymentTarget(mode) ? mode : null;
}

/**
 * True only for an exact staging/staging or production/production pair.
 * Every other target or platform mode is rejected.
 */
export function integrityMediaEnvironmentTargetAccepted(
  target: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const mode = readIntegrityMediaDeploymentTarget(env);
  return mode !== null && target === mode;
}
