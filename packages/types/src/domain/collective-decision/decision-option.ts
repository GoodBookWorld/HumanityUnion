export type DecisionOptionId = string;

export interface DecisionOption {
  optionId: DecisionOptionId;
  label: string;
  description: string;
  value: string;
  order: number;
}
