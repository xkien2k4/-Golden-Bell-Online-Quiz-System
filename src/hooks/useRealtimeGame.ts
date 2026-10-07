import { useEffect, useState, useRef, useCallback } from 'react';
import { ClientGameState } from '../types';
import { soundManager } from '../utils/soundEffects';
import { api } from '../services/api';

interface UseRealtimeGameOptions {
  competitionId?: string;
  enableSounds?: boolean;
  onStateChange?: (prev: ClientGameState | null, curr: ClientGameState) => void;
}

type StateListener = (state: ClientGameState, serverTimeOffset: number) => void;
type ConnectionListener = (connected: boolean, error: string | null) => void;

interface SharedStreamEntry {
  competitionId: string;
  latestState: ClientGameState | null;
  serverTimeOffset: number;
  isConnected: boolean;
  error: string | null;
  eventSource: EventSource | null;
  reconnectTimeout: number | null;
  fallbackInterval: number | null;
  reconnectAttempts: number;
  isFetching: boolean;
  stateListeners: Set<StateListener>;
  connectionListeners: Set<ConnectionListener>;
  cleanupWindowListeners?: () => void;
}

const sharedStreams = new Map<string, SharedStreamEntry>();

function notifyStateListeners(entry: SharedStreamEntry, data: ClientGameState, serverTime?: number) {
  if (!data) return;
  if (serverTime) {
    entry.serverTimeOffset = serverTime - Date.now();
  }
  entry.latestState = data;
  entry.isConnected = true;
  entry.error = null;

  entry.connectionListeners.forEach((listener) => listener(true, null));
  entry.stateListeners.forEach((listener) => listener(data, entry.serverTimeOffset));
}

function notifyConnectionListeners(entry: SharedStreamEntry, connected: boolean, error: string | null) {
  entry.isConnected = connected;
  entry.error = error;
  entry.connectionListeners.forEach((listener) => listener(connected, error));
}

async function fetchStateOnce(entry: SharedStreamEntry): Promise<void> {
  if (entry.isFetching) return;
  entry.isFetching = true;
  try {
    const res = await api.getState(entry.competitionId);
    if (res && res.data) {
      notifyStateListeners(entry, res.data, res.serverTime);
    }
  } catch {
    if (!entry.latestState) {
      notifyConnectionListeners(entry, false, 'Đang kết nối lại máy chủ...');
    }
  } finally {
    entry.isFetching = false;
  }
}

function connectSharedSSE(entry: SharedStreamEntry) {
  if (entry.stateListeners.size === 0) return;

  if (entry.reconnectTimeout !== null) {
    clearTimeout(entry.reconnectTimeout);
    entry.reconnectTimeout = null;
  }

  if (entry.eventSource) {
    if (
      entry.eventSource.readyState === EventSource.OPEN ||
      entry.eventSource.readyState === EventSource.CONNECTING
    ) {
      return;
    }
    entry.eventSource.close();
    entry.eventSource = null;
  }

  try {
    const es = new EventSource(`/api/competitions/${entry.competitionId}/stream`);
    entry.eventSource = es;

    es.onopen = () => {
      entry.reconnectAttempts = 0;
      notifyConnectionListeners(entry, true, null);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'STATE_UPDATE' && parsed.data) {
          entry.reconnectAttempts = 0;
          notifyStateListeners(entry, parsed.data, parsed.serverTime);
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    es.onerror = () => {
      es.close();
      if (entry.eventSource === es) {
        entry.eventSource = null;
      }
      notifyConnectionListeners(entry, false, entry.latestState ? null : 'Đang kết nối lại máy chủ...');

      if (entry.stateListeners.size === 0) return;

      entry.reconnectAttempts = Math.min(entry.reconnectAttempts + 1, 5);
      const delayMs = Math.min(30000, 4000 * Math.pow(1.8, entry.reconnectAttempts - 1));

      if (entry.reconnectTimeout !== null) {
        clearTimeout(entry.reconnectTimeout);
      }
      entry.reconnectTimeout = window.setTimeout(() => {
        entry.reconnectTimeout = null;
        connectSharedSSE(entry);
      }, delayMs);
    };
  } catch (err) {
    console.error('SSE initialization error:', err);
  }
}

function acquireSharedStream(
  competitionId: string,
  onState: StateListener,
  onConnection: ConnectionListener
): SharedStreamEntry {
  let entry = sharedStreams.get(competitionId);

  if (!entry) {
    entry = {
      competitionId,
      latestState: null,
      serverTimeOffset: 0,
      isConnected: false,
      error: null,
      eventSource: null,
      reconnectTimeout: null,
      fallbackInterval: null,
      reconnectAttempts: 0,
      isFetching: false,
      stateListeners: new Set(),
      connectionListeners: new Set(),
    };
    sharedStreams.set(competitionId, entry);

    const currentEntry = entry;

    currentEntry.fallbackInterval = window.setInterval(() => {
      const isSseOpen =
        currentEntry.eventSource && currentEntry.eventSource.readyState === EventSource.OPEN;
      if (!isSseOpen && !document.hidden && currentEntry.stateListeners.size > 0) {
        fetchStateOnce(currentEntry);
      }
    }, 15000);

    const handleWakeSync = () => {
      if (!document.hidden && currentEntry.stateListeners.size > 0) {
        const isSseOpen =
          currentEntry.eventSource && currentEntry.eventSource.readyState === EventSource.OPEN;
        if (!isSseOpen) {
          connectSharedSSE(currentEntry);
        }
      }
    };

    const handleUnload = () => {
      if (currentEntry.eventSource) {
        currentEntry.eventSource.close();
        currentEntry.eventSource = null;
      }
    };

    window.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('online', handleWakeSync);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    currentEntry.cleanupWindowListeners = () => {
      window.removeEventListener('visibilitychange', handleWakeSync);
      window.removeEventListener('online', handleWakeSync);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }

  entry.stateListeners.add(onState);
  entry.connectionListeners.add(onConnection);

  if (entry.latestState) {
    onState(entry.latestState, entry.serverTimeOffset);
    onConnection(entry.isConnected, entry.error);
  }

  connectSharedSSE(entry);

  return entry;
}

function releaseSharedStream(
  competitionId: string,
  onState: StateListener,
  onConnection: ConnectionListener
) {
  const entry = sharedStreams.get(competitionId);
  if (!entry) return;

  entry.stateListeners.delete(onState);
  entry.connectionListeners.delete(onConnection);

  if (entry.stateListeners.size === 0 && entry.connectionListeners.size === 0) {
    if (entry.reconnectTimeout !== null) {
      clearTimeout(entry.reconnectTimeout);
      entry.reconnectTimeout = null;
    }
    if (entry.fallbackInterval !== null) {
      clearInterval(entry.fallbackInterval);
      entry.fallbackInterval = null;
    }
    if (entry.eventSource) {
      entry.eventSource.close();
      entry.eventSource = null;
    }
    if (entry.cleanupWindowListeners) {
      entry.cleanupWindowListeners();
    }
    sharedStreams.delete(competitionId);
  }
}

export function useRealtimeGame({
  competitionId = 'comp-thpt-2510',
  enableSounds = true,
  onStateChange,
}: UseRealtimeGameOptions) {
  const [gameState, setGameState] = useState<ClientGameState | null>(() => {
    return sharedStreams.get(competitionId)?.latestState ?? null;
  });
  const [isConnected, setIsConnected] = useState<boolean>(() => {
    return sharedStreams.get(competitionId)?.isConnected ?? false;
  });
  const [error, setError] = useState<string | null>(() => {
    return sharedStreams.get(competitionId)?.error ?? null;
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const prevGameStateRef = useRef<ClientGameState | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const serverTimeOffsetRef = useRef<number>(
    sharedStreams.get(competitionId)?.serverTimeOffset ?? 0
  );
  const enableSoundsRef = useRef<boolean>(enableSounds);
  const onStateChangeRef = useRef<UseRealtimeGameOptions['onStateChange']>(onStateChange);

  useEffect(() => {
    enableSoundsRef.current = enableSounds;
  }, [enableSounds]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    if (!competitionId) return;

    const handleState: StateListener = (data, offset) => {
      serverTimeOffsetRef.current = offset;
      const prev = prevGameStateRef.current;
      prevGameStateRef.current = data;
      setGameState(data);

      if (onStateChangeRef.current) {
        onStateChangeRef.current(prev, data);
      }

      if (enableSoundsRef.current && soundManager.getEnabled() && prev) {
        if (data.gameState === 'ANSWERING' && prev.gameState !== 'ANSWERING') {
          soundManager.playQuestionStart();
        } else if (data.gameState === 'LOCKED' && prev.gameState === 'ANSWERING') {
          soundManager.playTimesUp();
        } else if (data.gameState === 'ANSWER_REVEALED' && prev.gameState !== 'ANSWER_REVEALED') {
          soundManager.playRevealAnswer();
        } else if (data.gameState === 'FINISHED' && prev.gameState !== 'FINISHED') {
          soundManager.playVictory();
        }
      }
    };

    const handleConnection: ConnectionListener = (connected, err) => {
      setIsConnected(connected);
      setError(err);
    };

    acquireSharedStream(competitionId, handleState, handleConnection);

    return () => {
      releaseSharedStream(competitionId, handleState, handleConnection);
    };
  }, [competitionId]);

  const fetchLatestState = useCallback(async () => {
    if (!competitionId) return;
    const entry = sharedStreams.get(competitionId);
    if (entry) {
      await fetchStateOnce(entry);
    }
  }, [competitionId]);

  const lastTickedSecondRef = useRef<number | null>(null);

  // Synchronized countdown timer loop
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (gameState?.gameState === 'ANSWERING' && gameState.questionEndTime) {
      const updateClock = () => {
        const adjustedNow = Date.now() + serverTimeOffsetRef.current;
        const diffMs = gameState.questionEndTime! - adjustedNow;
        const remaining = Math.max(0, Math.ceil(diffMs / 1000));
        setSecondsRemaining(remaining);

        // Countdown beat sound
        if (
          enableSounds &&
          soundManager.getEnabled() &&
          remaining > 0 &&
          lastTickedSecondRef.current !== remaining
        ) {
          lastTickedSecondRef.current = remaining;
          soundManager.playCountdownBeat(remaining);
        }
      };

      updateClock();
      timerIntervalRef.current = window.setInterval(updateClock, 250);
    } else {
      setSecondsRemaining(0);
      lastTickedSecondRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameState?.gameState, gameState?.questionEndTime, enableSounds]);

  return {
    gameState,
    isConnected,
    error,
    secondsRemaining,
    serverTimeOffset: serverTimeOffsetRef.current,
    refreshState: fetchLatestState,
  };
}
