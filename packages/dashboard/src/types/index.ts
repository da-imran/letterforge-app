export type GameMode = 'normal_mode' | 'time_attack' | 'survival_mode' | 'chain_mode';
export type Period = 'daily' | 'weekly' | 'all_time';

export interface User {
  _id: string;
  email: string;
  nickname: string | null;
  milestones: string[];
  createdAt: string;
}

export interface Game {
  _id: string;
  trace_id: string;
  mode: GameMode;
  letterCount: number;
  letters: string[];
  letterBatch?: string[][];
  batchIndex?: number;
  userId: string | null;
  createdAt: number;
  expiresAt: number | null;
  submissions: Array<{ word: string; points: number }>;
  usedWords: string[];
  score: number;
  isCompleted: boolean;
  round: number;
  maxRounds: number | null;
}

export interface SubmitWordResponse {
  valid: boolean;
  duplicate?: boolean;
  reason?: string;
  points: number;
  totalScore: number;
  letters?: string[];
  round?: number;
  maxRounds?: number | null;
  isCompleted?: boolean;
}

export interface ResetLettersResponse {
  letters: string[];
  usedWords: string[];
  totalScore: number;
}

export interface GameResult {
  gameId: string;
  mode: GameMode;
  score: number;
  usedWords: string[];
  isCompleted: boolean;
  userId: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string | null;
  totalScore: number;
  gameCount: number;
  lastPlayedAt: string;
}

export interface UserRank {
  rank: number;
  totalScore: number;
  gameCount: number;
  mode: GameMode;
  period: Period;
}

export interface UserTotalScore {
  totalScore: number;
  gameCount: number;
}

export interface Milestone {
  _id: string;
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'games' | 'points' | 'words' | 'special' | 'time_attack';
  checkType: string;
  threshold: number | null;
}
