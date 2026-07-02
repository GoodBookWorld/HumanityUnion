export interface DecisionRules {
  quorumRequired: number;
  minimumParticipationRate: number;
  approvalThreshold: number;
  winningMethod: string;
  tiePolicy: string;
  abstentionPolicy: string;
}
