import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, getToken, setToken } from '@/lib/api';

describe('api', () => {
  const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;
  const ORIGINAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE;

  const fetchMock = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock;
    localStorage.clear();
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local';
    process.env.NEXT_PUBLIC_API_BASE = '/api/v1';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    process.env.NEXT_PUBLIC_API_BASE = ORIGINAL_API_BASE;
  });

  const jsonResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);

  describe('auth headers', () => {
    it('attaches Authorization header when a token is stored', async () => {
      setToken('abc123');
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await api.getMe();

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('http://test.local/api/v1/auth/me');
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer abc123');
    });

    it('omits Authorization header when no token is stored', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await api.getMe();

      const [, opts] = fetchMock.mock.calls[0];
      expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws ApiError with server message on non-2xx', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Bad request: invalid word' }, 400));

      const error = await api.submitWord('game1', 'xyz').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Bad request: invalid word');
    });

    it('throws ApiError with status message when body is not JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response);

      const error = await api.getMe().catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(500);
      expect(error.message).toContain('500');
    });

    it('clears token and notifies listeners on 401', async () => {
      setToken('expired');
      const listener = vi.fn();
      window.addEventListener('letterforge:unauthorized', listener);

      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));

      const error = await api.getMe().catch((e) => e);

      expect(error.status).toBe(401);
      expect(getToken()).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);

      window.removeEventListener('letterforge:unauthorized', listener);
    });

    it('throws ApiError on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const error = await api.getMe().catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
    });
  });

  describe('request helpers', () => {
    it('POSTs JSON body with Content-Type', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ token: 't', user: { _id: 'u1' } }, 201));

      const result = await api.register('a@b.com', 'password1', 'Nick');

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(opts.body as string)).toEqual({ email: 'a@b.com', nickname: 'Nick', password: 'password1' });
      expect(result.token).toBe('t');
      expect(result.user._id).toBe('u1');
    });

    it('sends mode and period as query params', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await api.getLeaderboard('time_attack', 'weekly', 5, 0);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('mode=time_attack');
      expect(url).toContain('period=weekly');
      expect(url).toContain('limit=5');
    });
  });

  describe('daily challenge', () => {
    it('fetches today\'s challenge clue from /challenge/today', async () => {
      const challenge = { date: '2026-08-10', clue: 'To abolish, do away with, especially by authority', attempts: 5, seed: 'abc' };
      fetchMock.mockResolvedValueOnce(jsonResponse(challenge));

      const result = await api.getDailyChallenge();

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/challenge/today');
      expect(result.clue).toContain('abolish');
      expect(result.attempts).toBe(5);
    });
  });

  describe('duels', () => {
    const duel = {
      _id: 'd1',
      code: 'ABC123',
      letterCount: 3,
      letters: ['a', 'b', 'c'],
      mode: 'normal_mode',
      maxRounds: 10,
      status: 'open',
      result: null,
      winnerId: null,
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
      challenger: { userId: 'u1', nickname: 'A', score: null, submittedAt: null },
      opponent: { userId: null, nickname: 'Unknown', score: null, submittedAt: null },
      myGameId: 'g1',
    };

    it('creates a duel with a POST to /duels', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(duel, 201));

      const result = await api.createDuel();

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/duels');
      expect(opts.method).toBe('POST');
      expect(result.code).toBe('ABC123');
    });

    it('joins a duel by code with the code in the body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(duel));

      await api.joinDuelByCode('ABC123');

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({ code: 'ABC123' });
    });

    it('submits a duel score with gameId', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(duel));

      await api.submitDuelScore('d1', 'g1');

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/duels/d1/submit');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({ gameId: 'g1' });
    });
  });
});
