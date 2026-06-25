'use client';

import {
  GameMode,
  Period,
  Game,
  SubmitWordResponse,
  ResetLettersResponse,
  LeaderboardEntry,
  User,
  UserTotalScore,
  GameResult
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/letter-forge/v1';
const API_BASE_URL = `${API_URL}${API_BASE}`;

const EXPECTED_STATUS_CODES = [400, 404, 409];

async function fetchJson<T>(url: string, options?: RequestInit, defaultValue: T = null as unknown as T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      ...(options ?? {}),
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      if (!EXPECTED_STATUS_CODES.includes(res.status)) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { message: 'Failed to parse error response as JSON' };
        }

        console.error(`[LetterForge API Error] ${options?.method ?? 'GET'} ${url}:`, {
          status: res.status,
          statusText: res.statusText,
          error: errorData
        });
      }
      return defaultValue;
    }

    return await res.json();
  } catch (error) {
    console.error(`[LetterForge Network Error] ${options?.method ?? 'GET'} ${url}:`, error);
    return defaultValue;
  }
}

// API Service
export const api = {
  // Meta API
  getMeta: async () => {
    return fetchJson('/meta', {}, {});
  },

  getHealth: async () => {
    return fetchJson('/health', {}, {});
  },

  // Users API
  createUser: async (email: string, nickname?: string): Promise<User | null> => {
    return fetchJson<User | null>('/users', {
      method: 'POST',
      body: JSON.stringify({ email, nickname }),
    }, null);
  },

  getUserByNickname: async (nickname: string): Promise<User | null> => {
    return fetchJson<User | null>(`/users?nickname=${encodeURIComponent(nickname)}`, {}, null);
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    return fetchJson<User | null>(`/users?email=${encodeURIComponent(email)}`, {}, null);
  },

  getUserById: async (userId: string): Promise<User | null> => {
    return fetchJson<User | null>(`/users/${userId}`, {}, null);
  },

  updateUser: async (userId: string, nickname: string): Promise<User | null> => {
    return fetchJson<User | null>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    }, null);
  },

  deleteUser: async (userId: string): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>(`/users/${userId}`, {
      method: 'DELETE',
    }, { message: 'Operation failed' });
  },

  // Games API
  createGame: async (data: { mode: GameMode; userId?: string; letterCount?: number; letters?: string[] }): Promise<Game | null> => {
    return fetchJson<Game | null>('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    }, null);
  },

  loadGame: async (gameId: string): Promise<Game | null> => {
    return fetchJson<Game | null>(`/games/${gameId}`, {}, null);
  },

  submitWord: async (gameId: string, word: string): Promise<SubmitWordResponse> => {
    return fetchJson<SubmitWordResponse>(`/games/${gameId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ word }),
    }, { valid: false, points: 0, totalScore: 0 });
  },

  resetLetters: async (gameId: string, letterCount: number = 2): Promise<ResetLettersResponse> => {
    return fetchJson<ResetLettersResponse>(`/games/${gameId}/reset`, {
      method: 'POST',
      body: JSON.stringify({ letterCount }),
    }, { letters: [], usedWords: [], totalScore: 0 });
  },

  refillBatch: async (gameId: string): Promise<{ letterBatch: string[][]; batchIndex: number; letters: string[] }> => {
    return fetchJson(`/games/${gameId}/batch`, {
      method: 'POST',
    }, { letterBatch: [], batchIndex: 0, letters: [] });
  },

  completeGame: async (gameId: string): Promise<{ score: number; isCompleted: boolean }> => {
    return fetchJson<{ score: number; isCompleted: boolean }>(`/games/${gameId}/complete`, {
      method: 'POST',
    }, { score: 0, isCompleted: true });
  },

  getGameResult: async (gameId: string): Promise<GameResult | null> => {
    return fetchJson<GameResult | null>(`/games/${gameId}/result`, {}, null);
  },

  deleteGame: async (gameId: string): Promise<{ message: string }> => {
    return fetchJson<{ message: string }>(`/games/${gameId}`, {
      method: 'DELETE',
    }, { message: 'Game deleted' });
  },

  submitToLeaderboard: async (gameId: string, period: Period = 'all_time'): Promise<any> => {
    return fetchJson(`/games/${gameId}/leaderboard`, {
      method: 'POST',
      body: JSON.stringify({ period }),
    }, null);
  },

  // Scores API
  createScore: async (data: { userId: string; gameId: string; mode: GameMode; points: number }) => {
    return fetchJson('/scores', {
      method: 'POST',
      body: JSON.stringify(data),
    }, null);
  },

  getScoresByGame: async (gameId: string) => {
    return fetchJson<any[]>(`/scores/game/${gameId}`, {}, []);
  },

  getScoresByUser: async (userId: string) => {
    return fetchJson<any[]>(`/scores/user/${userId}`, {}, []);
  },

  getUserTotalScore: async (userId: string, mode: GameMode, period: Period): Promise<UserTotalScore> => {
    return fetchJson<UserTotalScore>(`/scores/user/${userId}/total?mode=${mode}&period=${period}`, {}, { totalScore: 0, gameCount: 0 });
  },

  // Leaderboards API
  getLeaderboard: async (mode: GameMode, period: Period, limit: number = 10, offset: number = 0): Promise<LeaderboardEntry[]> => {
    return fetchJson<LeaderboardEntry[]>(`/leaderboard?mode=${mode}&period=${period}&limit=${limit}&offset=${offset}`, {}, []);
  },

  submitLeaderboardScore: async (data: { userId: string; mode: GameMode; period: Period; score: number }) => {
    return fetchJson('/leaderboard/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }, null);
  },

  getUserRank: async (userId: string, period: Period) => {
    return fetchJson(`/leaderboard/rank/${userId}?period=${period}`, {}, null);
  },

  // Get all leaderboard data for all users
  getAllLeaderboard: async () => {
    return fetchJson<any>('/leaderboard/all', {}, null);
  },

  // Milestones API
  getAllMilestones: async () => {
    return fetchJson<any[]>('/milestones', {}, []);
  },

  getUserMilestones: async (userId: string) => {
    return fetchJson<any[]>(`/milestones/user/${userId}`, {}, []);
  },

  checkMilestones: async (userId: string, stats: any) => {
    return fetchJson<{ newlyUnlocked: string[]; count: number }>(`/milestones/check/${userId}`, {
      method: 'POST',
      body: JSON.stringify(stats),
    }, { newlyUnlocked: [], count: 0 });
  }
};
