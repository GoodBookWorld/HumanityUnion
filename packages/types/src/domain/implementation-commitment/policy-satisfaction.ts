/** Derived indicator that applicable Frozen Policy conditions are met. */
export interface PolicySatisfaction {
  satisfied: boolean;
  evaluatedAt: string;
  explanation: string;
}
