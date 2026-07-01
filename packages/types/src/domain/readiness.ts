export interface Readiness {
  readinessScore: number;
  satisfiedRequirements: string[];
  missingRequirements: string[];
  blockingIssues: string[];
}
