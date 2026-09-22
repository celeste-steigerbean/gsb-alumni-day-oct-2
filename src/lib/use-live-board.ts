"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BoardPayload } from "./board-payload";
import { withBase } from "./base-path";

export type Transport = "sse" | "poll";
export type ConnectionStatus = "connecting" | "live" | "stalled";

const POLL_INTERVAL_MS = 2_000;
/** No frame for this long means the connection died quietly, usually a sleep. */
const STALE_AFTER_MS = 20_000;
const WATCHDOG_INTERVAL_MS = 2_500;
/** Two clean failures is enough. Stop fighting and poll. */
const MAX_SSE_FAILURES = 2;

export type LiveBoard = {
  payload: BoardPayload | null;
  status: ConnectionStatus;
  transport: Transport;
  error: string | null;
  /** Pulls immediately, for example right after this visitor submits. */
  refresh: () => void;
  /** Adopts a payload the caller already has, with no round trip. */
  adopt: (next: BoardPayload) => void;
};

export function useLiveBoard(options: {
  mode: "submit" | "live";
  initial?: BoardPayload | null;
  /** Set from a URL flag to skip SSE entirely if it misbehaves in the room. */
  forcePolling?: boolean;
}): LiveBoard {
  const { mode, forcePolling = false } = options;

  const [payload, setPayload] = useState<BoardPayload | null>(options.initial ?? null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [transport, setTransport] = useState<Transport>(forcePolling ? "poll" : "sse");
  const [error, setError] = useState<string | null>(null);

  const versionRef = useRef<string | null>(options.initial?.version ?? null);
  const lastFrameRef = useRef<number>(Date.now());
  const sourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failuresRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const apply = useCallback((next: BoardPayload) => {
    versionRef.current = next.version;
    lastFrameRef.current = Date.now();
    setPayload(next);
    setStatus("live");
    setError(null);
  }, []);

  const fetchOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const params = new URLSearchParams({ mode });
      if (versionRef.current) params.set("v", versionRef.current);
      const response = await fetch(withBase(`/api/entries?${params.toString()}`), {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`status ${response.status}`);

      const body = (await response.json()) as BoardPayload | { unchanged: true; version: string };
      if (!mountedRef.current) return;

      lastFrameRef.current = Date.now();
      if ("unchanged" in body) {
        setStatus("live");
        setError(null);
      } else {
        apply(body);
      }
    } catch (cause) {
      if (!mountedRef.current) return;
      setStatus("stalled");
      setError(cause instanceof Error ? cause.message : "network");
    } finally {
      inFlightRef.current = false;
    }
  }, [apply, mode]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    void fetchOnce();
    pollTimerRef.current = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS);
  }, [fetchOnce, stopPolling]);

  const closeSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  }, []);

  const fallBackToPolling = useCallback(() => {
    closeSource();
    setTransport("poll");
    startPolling();
  }, [closeSource, startPolling]);

  const openSource = useCallback(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      fallBackToPolling();
      return;
    }
    closeSource();

    const source = new EventSource(withBase(`/api/entries/stream?mode=${mode}`));
    sourceRef.current = source;

    source.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        apply(JSON.parse(event.data) as BoardPayload);
        failuresRef.current = 0;
      } catch {
        // A malformed frame is not worth tearing the connection down for.
      }
    };

    source.onopen = () => {
      lastFrameRef.current = Date.now();
      failuresRef.current = 0;
    };

    source.onerror = () => {
      if (!mountedRef.current) return;
      // A retiring stream also lands here, but with the browser already
      // reconnecting. Only a closed source counts as a real failure.
      if (source.readyState === EventSource.CLOSED) {
        failuresRef.current += 1;
        if (failuresRef.current >= MAX_SSE_FAILURES) {
          fallBackToPolling();
        } else {
          setStatus("stalled");
          window.setTimeout(() => {
            if (mountedRef.current && sourceRef.current === source) openSource();
          }, 1_000);
        }
      }
    };
  }, [apply, closeSource, fallBackToPolling, mode]);

  // Boot. One fetch paints immediately, then the live transport takes over.
  useEffect(() => {
    mountedRef.current = true;
    void fetchOnce();

    if (forcePolling) {
      setTransport("poll");
      startPolling();
    } else {
      openSource();
    }

    return () => {
      mountedRef.current = false;
      closeSource();
      stopPolling();
    };
  }, [closeSource, fetchOnce, forcePolling, openSource, startPolling, stopPolling]);

  // Watchdog. Catches a connection that went quiet without erroring, which is
  // what a closed laptop lid produces.
  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return;
      if (Date.now() - lastFrameRef.current < STALE_AFTER_MS) return;

      setStatus("stalled");
      if (transport === "sse") {
        failuresRef.current += 1;
        if (failuresRef.current >= MAX_SSE_FAILURES) fallBackToPolling();
        else openSource();
      } else {
        void fetchOnce();
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(id);
  }, [fallBackToPolling, fetchOnce, openSource, transport]);

  // Wake and reconnect events. Pull first, then rebuild the live transport.
  useEffect(() => {
    const revive = () => {
      if (!mountedRef.current) return;
      void fetchOnce();
      if (transport === "sse") openSource();
      else startPolling();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") revive();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", revive);
    window.addEventListener("pageshow", revive);
    window.addEventListener("focus", revive);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", revive);
      window.removeEventListener("pageshow", revive);
      window.removeEventListener("focus", revive);
    };
  }, [fetchOnce, openSource, startPolling, transport]);

  const refresh = useCallback(() => {
    versionRef.current = null;
    void fetchOnce();
  }, [fetchOnce]);

  return { payload, status, transport, error, refresh, adopt: apply };
}
