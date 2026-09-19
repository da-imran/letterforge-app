export type GameMode = 'normal_mode' | 'time_attack' | 'survival_mode' | 'chain_mode' | 'fade_mode' | 'daily_challenge';
// Wawasan 2020 is duel-only: it never appears as a solo play mode.
export type WawasanMode = 'wawasan_mode';
export type DuelMode = Exclude<GameMode, 'daily_challenge' | 'fade_mode'> | WawasanMode;
export type Period = 'daily' | 'weekly' | 'all_time';

export interface DailyChallenge {
  date: string;
  clue: string;
  meanings?: string[];
  attempts: number;
  seed: string;
}

export type DuelStatus = 'open' | 'active' | 'playing' | 'completed';
export type DuelResult = 'challenger' | 'opponent' | 'draw' | null;

export interface DuelParticipant {
  userId: string | null;
  nickname: string;
  score: number | null;
  submittedAt: string | null;
  lastActiveAt: string | null;
  disconnectedAt: string | null;
  forfeited: boolean;
}

export interface WawasanRoundState {
  letter: string;
  status: 'open' | 'review' | 'done';
  answers: { challenger: Array<string | null>; opponent: Array<string | null> };
  submitted: { challenger: boolean; opponent: boolean };
  confirmed?: { challenger: boolean; opponent: boolean };
  challenges?: { challenger: Record<string, boolean>; opponent: Record<string, boolean> };
}

export interface WawasanState {
  columns: string[];
  letters: string[];
  currentRound: number;
  pointsPerColumn: number;
  rounds: WawasanRoundState[];
  stoppedAt: string | null;
}

export interface Duel {
  _id: string;
  code: string;
  letterCount: number;
  letters: string[] | null;
  mode: DuelMode | null;
  maxRounds: number | null;
  wawasan: WawasanState | null;
  status: DuelStatus;
  result: DuelResult;
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  challenger: DuelParticipant;
  opponent: DuelParticipant;
  myGameId: string | null;
}

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
  lives?: number;
  maxLives?: number | null;
  lastLetter?: string;
  currentScore?: number;
  clue?: string;
  dailyAnswer?: string;
  dailyMeanings?: string[];
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
  allScore: number;
}

export interface UserRank {
  rank: number;
  totalScore: number;
  gameCount: number;
  mode: GameMode;
  period: Period;
}

export interface ModeStats {
  totalScore: number;
  gameCount: number;
}

export interface UserStats {
  normal_mode: ModeStats;
  time_attack: ModeStats;
  survival_mode: ModeStats;
  chain_mode: ModeStats;
  fade_mode: ModeStats;
}

export interface AuthResponse {
  token: string;
  user: User;
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
