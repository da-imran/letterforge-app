import {
  GameMode,
  Period,
  Game,
  SubmitWordResponse,
  ResetLettersResponse,
  LeaderboardEntry,
  User,
  UserRank,
  UserTotalScore,
  GameResult,
  AuthResponse,
  UserStats,
  Milestone,
  Duel,
  DailyChallenge
} from '@/types';

const TOKEN_KEY = 'letterforge_token';

function getApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/letter-forge/v1';
  return `${apiUrl}${apiBase}`;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

const UNAUTHORIZED_EVENT = 'letterforge:unauthorized';

export function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

export function onUnauthorized(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(UNAUTHORIZED_EVENT, callback);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, callback);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${url}`, { ...(options ?? {}), headers });
  } catch (err) {
    throw new ApiError(0, 'Network error - could not reach the server. Please try again.', err);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let data: unknown;
    try {
      data = await res.json();
      if (data && typeof data === 'object' && 'message' in (data as object)) {
        const candidate = (data as { message?: unknown }).message;
        if (typeof candidate === 'string' && candidate) message = candidate;
      }
    } catch {
      // Response body was not JSON.
    }

    if (res.status === 401) {
      setToken(null);
      notifyUnauthorized();
    }

    throw new ApiError(res.status, message, data);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json();
}

// API Service
export const api = {
  // Auth API
  register: async (email: string, password: string, nickname?: string): Promise<AuthResponse> => {
    return fetchJson<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, nickname, password }),
    });
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    return fetchJson<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getMe: async (): Promise<User> => {
    return fetchJson<User>('/auth/me');
  },

  // Users API
  getUserById: async (userId: string): Promise<User> => {
    return fetchJson<User>(`/users/${userId}`);
  },

  getUserByNickname: async (nickname: string): Promise<User> => {
    return fetchJson<User>(`/users?nickname=${encodeURIComponent(nickname)}`);
  },

  getUserStats: async (userId: string): Promise<UserStats> => {
    return fetchJson<UserStats>(`/users/${userId}/stats`);
  },

  updateUser: async (userId: string, nickname: string): Promise<User> => {
    return fetchJson<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
  },

  deleteUser: async (userId: string): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>(`/users/${userId}`, { method: 'DELETE' });
  },

  // Games API
  getDailyChallenge: async (): Promise<DailyChallenge> => {
    return fetchJson<DailyChallenge>('/challenge/today');
  },

  createGame: async (data: { mode: GameMode; letterCount?: number; letters?: string[] }): Promise<Game> => {
    return fetchJson<Game>('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  loadGame: async (gameId: string): Promise<Game> => {
    return fetchJson<Game>(`/games/${gameId}`);
  },

  submitWord: async (gameId: string, word: string): Promise<SubmitWordResponse> => {
    return fetchJson<SubmitWordResponse>(`/games/${gameId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
  },

  resetLetters: async (gameId: string, letterCount: number = 2): Promise<ResetLettersResponse> => {
    return fetchJson<ResetLettersResponse>(`/games/${gameId}/reset`, {
      method: 'POST',
      body: JSON.stringify({ letterCount }),
    });
  },

  refillBatch: async (gameId: string): Promise<{ letterBatch: string[][]; batchIndex: number; letters: string[] }> => {
    return fetchJson(`/games/${gameId}/batch`, {
      method: 'POST',
    });
  },

  completeGame: async (gameId: string): Promise<{ score: number; isCompleted: boolean }> => {
    return fetchJson<{ score: number; isCompleted: boolean }>(`/games/${gameId}/complete`, {
      method: 'POST',
    });
  },

  getGameResult: async (gameId: string): Promise<GameResult> => {
    return fetchJson<GameResult>(`/games/${gameId}/result`);
  },

  deleteGame: async (gameId: string): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>(`/games/${gameId}`, { method: 'DELETE' });
  },

  submitToLeaderboard: async (gameId: string, period: Period = 'all_time'): Promise<{ message: string; score: object }> => {
    return fetchJson(`/games/${gameId}/leaderboard`, {
      method: 'POST',
      body: JSON.stringify({ period }),
    });
  },

  // Scores API
  createScore: async (data: { userId: string; gameId: string; mode: GameMode; points: number }): Promise<object> => {
    return fetchJson('/scores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getScoresByGame: async (gameId: string): Promise<object[]> => {
    return fetchJson<object[]>(`/scores/game/${gameId}`);
  },

  getScoresByUser: async (userId: string): Promise<object[]> => {
    return fetchJson<object[]>(`/scores/user/${userId}`);
  },

  getUserTotalScore: async (userId: string, mode: GameMode, period: Period): Promise<UserTotalScore> => {
    return fetchJson<UserTotalScore>(`/scores/user/${userId}/total?mode=${mode}&period=${period}`);
  },

  // Leaderboards API
  getLeaderboard: async (mode: GameMode, period: Period, limit: number = 10, offset: number = 0): Promise<LeaderboardEntry[]> => {
    return fetchJson<LeaderboardEntry[]>(`/leaderboard?mode=${mode}&period=${period}&limit=${limit}&offset=${offset}`);
  },

  submitLeaderboardScore: async (data: { userId: string; mode: GameMode; period: Period; score: number }): Promise<object> => {
    return fetchJson('/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getUserRank: async (userId: string, mode: GameMode, period: Period): Promise<UserRank> => {
    return fetchJson<UserRank>(`/leaderboard/rank/${userId}?mode=${mode}&period=${period}`);
  },

  // Milestones API
  getAllMilestones: async (): Promise<Milestone[]> => {
    return fetchJson<Milestone[]>('/milestones');
  },

  getUserMilestones: async (userId: string): Promise<Milestone[]> => {
    return fetchJson<Milestone[]>(`/milestones/user/${userId}`);
  },

  // Duels API
  createDuel: async (letterCount?: number): Promise<Duel> => {
    return fetchJson<Duel>('/duels', {
      method: 'POST',
      body: JSON.stringify({ letterCount }),
    });
  },

  getDuel: async (duelId: string): Promise<Duel> => {
    return fetchJson<Duel>(`/duels/${duelId}`);
  },

  enterDuel: async (duelId: string): Promise<Duel> => {
    return fetchJson<Duel>(`/duels/${duelId}/enter`, { method: 'POST' });
  },

  joinDuelByCode: async (code: string): Promise<Duel> => {
    return fetchJson<Duel>('/duels/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  getDuelByCode: async (code: string): Promise<Duel> => {
    return fetchJson<Duel>(`/duels/code/${encodeURIComponent(code)}`);
  },

  submitDuelScore: async (duelId: string, gameId: string): Promise<Duel> => {
    return fetchJson<Duel>(`/duels/${duelId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  },
};
