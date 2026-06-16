// @soltrade/trading-engine — leader-insights type surface (hand-written, ADR-0001 Phase Engine-3).

export type LeaderRecommendation = 'follow' | 'drop' | 'watch';

export interface LeaderStats {
  trades: number;
  total_realized: number;
  win_rate: number;
  [k: string]: unknown;
}

export function recommendLeader(opts: { stats: LeaderStats; minSample: number; evGateRejected?: boolean }): LeaderRecommendation;

export function scoreLeader(stats: { total_realized: number; win_rate: number }): number;

export interface LeaderRow {
  leader: string;
  score: number;
  recommendation: LeaderRecommendation;
  [k: string]: unknown;
}

export function finalizeLeaderInsights<T extends LeaderRow>(opts: { mode?: string | null; leaders?: T[] }): {
  mode: string | null;
  leaders: T[];
  recommendation: { follow: string[]; drop: string[]; watch: string[] };
};
