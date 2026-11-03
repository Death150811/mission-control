import type { Difficulty } from '../types';

export interface DifficultyRules {
  label: string;
  budgetMul: number;       // multiplies the scenario budget
  designMargin: number;    // required engineering margin (mass, delta-v, power)
  contingency: number;     // fraction of hardware + launch cost held as reserve
  anomalyMul: number;      // multiplies anomaly probabilities
  linkMarginDb: number;
  guidance: boolean;       // show guided recommendations
  summary: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  beginner: { label: 'BEGINNER', budgetMul: 1.25, designMargin: 0.05, contingency: 0.08, anomalyMul: 0.5, linkMarginDb: 3, guidance: true,
    summary: 'Simplified margins, bigger budget, fewer anomalies, step-by-step recommendations and an auto-design helper.' },
  engineer: { label: 'ENGINEER', budgetMul: 1.0, designMargin: 0.10, contingency: 0.15, anomalyMul: 1.0, linkMarginDb: 3, guidance: false,
    summary: 'Realistic trade-offs: 10% design margins, 15% contingency, standard anomaly rates, minimal hints.' },
  expert: { label: 'EXPERT', budgetMul: 0.9, designMargin: 0.15, contingency: 0.2, anomalyMul: 1.5, linkMarginDb: 6, guidance: false,
    summary: 'Tight margins: 15% design margin, 6 dB link margin, 20% contingency, 90% budget, 1.5x anomaly rate.' },
};
