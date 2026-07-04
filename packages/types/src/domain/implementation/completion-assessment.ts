/** Derived evaluation of Completion Criteria satisfaction. */
export interface CompletionAssessment {
  assessmentReached: boolean;
  satisfiedCriteria: string[];
  unsatisfiedCriteria: string[];
  evaluatedAt: string;
  explanation: string;
}
