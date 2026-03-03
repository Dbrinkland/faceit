"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import type {
  FaceitDashboardError,
  FaceitDashboardResponse
} from "@/lib/types";

const CACHE_KEY = "faceit-war-room-cache-v1";

type DashboardStatus = "loading" | "ready" | "error";
type DashboardSource = "idle" | "live" | "cache";

type CacheEnvelope = {
  savedAt: string;
  data: FaceitDashboardResponse;
};

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.data?.players?.length) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: FaceitDashboardResponse) {
  if (typeof window === "undefined" || data.players.length === 0) {
    return;
  }

  const payload: CacheEnvelope = {
    savedAt: new Date().toISOString(),
    data
  };

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

export function useFaceitDashboard() {
  const [data, setData] = useState<FaceitDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [source, setSource] = useState<DashboardSource>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function fetchDashboard(mode: "initial" | "manual") {
    if (!mountedRef.current) {
      return;
    }

    setIsRefreshing(true);
    if (mode === "manual") {
      setError(null);
    }

    try {
      const response = await fetch("/api/faceit-dashboard", {
        cache: "no-store"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as FaceitDashboardError | null;
        throw new Error(payload?.message ?? "FACEIT-kaldet fejlede.");
      }

      const payload = (await response.json()) as FaceitDashboardResponse;
      if (!payload.players?.length) {
        throw new Error("FACEIT leverede ingen spillere i svaret.");
      }

      writeCache(payload);

      startTransition(() => {
        setData(payload);
        setStatus("ready");
        setSource("live");
        setLastSavedAt(payload.generatedAt);
        setError(null);
      });
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Der opstod en ukendt fejl under opdatering.";

      const cached = readCache();
      if (cached) {
        startTransition(() => {
          if (!data) {
            setData(cached.data);
          }
          setStatus("ready");
          setSource("cache");
          setLastSavedAt(cached.savedAt);
          setError(message);
        });
      } else {
        startTransition(() => {
          setStatus("error");
          setSource("idle");
          setError(message);
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setStatus("ready");
      setSource("cache");
      setLastSavedAt(cached.savedAt);
    }

    void fetchDashboard("initial");
  }, []);

  return {
    data,
    error,
    status,
    source,
    lastSavedAt,
    isRefreshing,
    refresh: () => fetchDashboard("manual")
  };
}

