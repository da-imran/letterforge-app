import { Duel } from '@/types';
import { getToken } from '@/lib/api';

const getApiOrigin = () =>
  typeof window !== 'undefined'
    ? (() => {
        const configured = process.env.NEXT_PUBLIC_API_URL || '';
        // Loopback overrides are the dev default — ignore them and use the
        // host serving this page so LAN devices reach the server's address.
        const isLoopbackOverride = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?/.test(configured);
        if (configured && !isLoopbackOverride) {
          return configured.replace(/\/$/, '');
        }
        return `${window.location.protocol}//${window.location.hostname}:8888`;
      })()
    : 'http://localhost:8888';

const API_ORIGIN = getApiOrigin();

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = Infinity;

export type ConnectionState = 'open' | 'reconnecting' | 'closed';

export interface RealtimeOptions {
  onConnectionChange?: (state: ConnectionState) => void;
}

/**
 * Open a resilient WebSocket to the realtime hub and subscribe to live duel
 * updates. Automatically reconnects with exponential backoff, sends periodic
 * heartbeats, and re-subscribes after each reconnect.
 *
 * Returns a cleanup function that tears everything down and stops reconnecting.
 *
 * The hub lives at the server root (`/ws?token=<jwt>`), not under the API base.
 */
export function subscribeToDuel(
  duelId: string,
  onUpdate: (duel: Duel) => void,
  options?: RealtimeOptions
): () => void {
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  const url = `${API_ORIGIN}/ws${query}`;

  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;

  const report = (next: ConnectionState) => options?.onConnectionChange?.(next);

  const cleanupTimers = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      report('closed');
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * Math.pow(1.5, reconnectAttempts - 1)
    );
    report('reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closed) return;
      connect();
    }, delay);
    reconnectTimer?.unref?.();
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
      // Expect a pong back shortly after each ping.
      armPongTimeout();
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref?.();
  };

  const armPongTimeout = () => {
    if (pongTimer) clearTimeout(pongTimer);
    pongTimer = setTimeout(() => {
      // No pong received in time — assume the connection is dead and reconnect.
      report('reconnecting');
      safeClose();
      scheduleReconnect();
    }, PONG_TIMEOUT_MS);
    pongTimer?.unref?.();
  };

  const safeClose = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try {
          socket.send(JSON.stringify({ type: 'unsubscribe', duelId }));
        } catch {
          // ignore — socket may already be torn down
        }
        socket.close();
      }
    }
  };

  const connect = () => {
    reconnectAttempts = 0;
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      report('open');
      socket?.send(JSON.stringify({ type: 'subscribe', duelId }));
      startHeartbeat();
    });

    socket.addEventListener('message', (event) => {
      if (closed) return;
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'pong') {
          if (pongTimer) {
            clearTimeout(pongTimer);
            pongTimer = null;
          }
          return;
        }
        if (msg.type === 'duel:update' && msg.duel) {
          onUpdate(msg.duel as Duel);
        }
      } catch {
        // Ignore non-JSON frames.
      }
    });

    socket.addEventListener('close', () => {
      cleanupTimers();
      report('reconnecting');
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (!closed) report('reconnecting');
    });
  };

  connect();

  return () => {
    closed = true;
    cleanupTimers();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    report('closed');
    safeClose();
  };
}
