"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  Flame,
  RefreshCw,
  Shield,
  Swords,
  Target,
  Trophy,
  WifiOff
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import styles from "./DashboardClient.module.css";
import { DashboardSettings } from "./DashboardSettings";
import { OperatorSpinner } from "./OperatorSpinner";
import { getCs2MapInfo } from "@/lib/cs2";
import { buildDashboardView, sortDateDescending } from "@/lib/dashboardView";
import { useFaceitDashboard } from "@/hooks/useFaceitDashboard";
import { formatAgo, formatDateTime, formatNumber, formatPercent } from "@/lib/format";

const TeaserOverlay = dynamic(
  () => import("./TeaserOverlay").then((module) => module.TeaserOverlay),
  {
    ssr: false
  }
);

import cleaningImage from "@/assets/cleaning.png";
import rushLangosImage from "@/assets/rushlangos.jpeg";
import sunnyBannedImage from "@/assets/sunny-banned.png";
import washToiletsImage from "@/assets/wash_toilets.webp";

const TEASER_STORAGE_KEY = "faceit-war-room-teaser-seen-v1";
const MATCH_DAY_LOCK_STORAGE_KEY = "faceit-war-room-lock-to-07032026-v1";
const SNACK_LOAD_STORAGE_KEY = "faceit-war-room-snack-load-v1";
const SNACK_SCORE_MONSTER_MULTIPLIER = 12;
const FACEIT_ELO_STEP = 25;
const FALLBACK_SNACK_NICKNAMES = ["v1rtux", "C10_dk", "OllieReed", "SunnyTheB", "Wond3r_"];

const BOO_MESSAGES = [
  "Boooo!",
  "Banhammer",
  "get well soon",
  "should've chosen may!",
  "🍎"
];

function formatPeakLabel(value: number) {
  return value >= 2 ? `${value}K peak` : "Ingen peak";
}

type ViewMode = "dashboard" | "sonny" | "tactics" | "snacks";
type SnackLoadEntry = {
  nickname: string;
  spend: string;
  monsterCount: string;
  loadout: string;
};

function formatSignedNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  if (value > 0) {
    return `+${formatNumber(value, digits)}`;
  }

  return formatNumber(value, digits);
}

function parseSnackNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function syncSnackEntries(nicknames: string[], current: SnackLoadEntry[]) {
  const currentMap = new Map(current.map((entry) => [entry.nickname.toLowerCase(), entry]));
  return nicknames.map((nickname) => {
    const existing = currentMap.get(nickname.toLowerCase());
    return (
      existing ?? {
        nickname,
        spend: "",
        monsterCount: "",
        loadout: ""
      }
    );
  });
}

export function DashboardClient() {
  const { data, error, status, source, lastSavedAt, isRefreshing, refresh } = useFaceitDashboard();
  const [isTeaserOpen, setIsTeaserOpen] = useState(false);
  const [lockToMatchDay, setLockToMatchDay] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [booReactions, setBooReactions] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const [booMessageIndex, setBooMessageIndex] = useState(0);
  const [snackEntries, setSnackEntries] = useState<SnackLoadEntry[]>([]);

  const displayData = useMemo(
    () => buildDashboardView(data, lockToMatchDay),
    [data, lockToMatchDay]
  );
  const players = displayData?.players ?? [];
  const summary = displayData?.summary ?? null;
  const operations = displayData?.operations ?? {
    recentMatches: [],
    matchDayMatches: [],
    mapPerformance: [],
    multiKillLeaders: []
  };
  const rosterNicknames =
    data?.trackedNicknames?.length
      ? data.trackedNicknames
      : players.length > 0
        ? players.map((player) => player.nickname)
        : FALLBACK_SNACK_NICKNAMES;
  const syncStamp = lastSavedAt ?? data?.generatedAt ?? null;
  const latestMatch = operations.recentMatches[0] ?? null;
  const latestMap = getCs2MapInfo(latestMatch?.map ?? null);
  const sourceLabel =
    source === "live" ? "Live snapshot" : source === "cache" ? "Cached snapshot" : "Ingen snapshot endnu";
  const matchDayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("da-DK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Copenhagen"
      }).format(syncStamp ? new Date(syncStamp) : new Date()),
    [syncStamp]
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const forcedTeaser = params.get("teaser") === "1";
      const seenTeaser = window.localStorage.getItem(TEASER_STORAGE_KEY) === "true";
      setIsTeaserOpen(forcedTeaser || !seenTeaser);
      setLockToMatchDay(window.localStorage.getItem(MATCH_DAY_LOCK_STORAGE_KEY) === "true");
      const savedSnacks = window.localStorage.getItem(SNACK_LOAD_STORAGE_KEY);
      if (savedSnacks) {
        const parsed = JSON.parse(savedSnacks) as SnackLoadEntry[];
        if (Array.isArray(parsed)) {
          setSnackEntries(parsed);
        }
      }
    } catch {
      setIsTeaserOpen(true);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MATCH_DAY_LOCK_STORAGE_KEY, lockToMatchDay ? "true" : "false");
    } catch {}
  }, [lockToMatchDay]);

  useEffect(() => {
    setSnackEntries((current) => syncSnackEntries(rosterNicknames, current));
  }, [rosterNicknames.join("|")]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SNACK_LOAD_STORAGE_KEY, JSON.stringify(snackEntries));
      } catch {}
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [snackEntries]);

  function closeTeaser() {
    try {
      window.localStorage.setItem(TEASER_STORAGE_KEY, "true");
    } catch {}

    setIsTeaserOpen(false);
  }

  function replayTeaser() {
    setIsTeaserOpen(true);
  }

  function toggleLockToMatchDay() {
    setLockToMatchDay((current) => !current);
  }

  function throwBoo() {
    const text = BOO_MESSAGES[booMessageIndex % BOO_MESSAGES.length];
    setBooMessageIndex((i) => (i + 1) % BOO_MESSAGES.length);

    const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
    const centerY = typeof window !== "undefined" ? window.innerHeight * 0.42 : 300;
    const x = centerX + (Math.random() - 0.5) * 240;
    const y = centerY + (Math.random() - 0.5) * 120;

    setBooReactions((prev) => [...prev.slice(-4), { id: Date.now(), x, y, text }]);
  }

  function updateSnackEntry(nickname: string, field: keyof Omit<SnackLoadEntry, "nickname">, value: string) {
    setSnackEntries((current) =>
      current.map((entry) =>
        entry.nickname.toLowerCase() === nickname.toLowerCase()
          ? {
              ...entry,
              [field]: value
            }
          : entry
      )
    );
  }

  function clearSnackEntry(nickname: string) {
    setSnackEntries((current) =>
      current.map((entry) =>
        entry.nickname.toLowerCase() === nickname.toLowerCase()
          ? {
              ...entry,
              spend: "",
              monsterCount: "",
              loadout: ""
            }
          : entry
      )
    );
  }

  const orderedPlayers = useMemo(
    () =>
      [...players].sort(
        (left, right) =>
          sortDateDescending(left.lastMatch?.finishedAt ?? null, right.lastMatch?.finishedAt ?? null) ||
          right.impactScore - left.impactScore
      ),
    [players]
  );

  const impactSortedPlayers = useMemo(
    () => [...players].sort((left, right) => right.impactScore - left.impactScore),
    [players]
  );

  const recentOutputData = useMemo(
    () =>
      operations.recentMatches.map((entry, index) => {
        const mapInfo = getCs2MapInfo(entry.map);

        return {
          key: entry.matchId,
          label: `${mapInfo.code} ${index + 1}`,
          mapCode: mapInfo.code,
          mapName: mapInfo.displayName,
          finishedAt: entry.finishedAt,
          score: entry.score ?? "--",
          result: entry.result,
          averageKills: entry.averageKills,
          averageKd: entry.averageKd,
          averageKr: entry.averageKr,
          averageAdr: entry.averageAdr,
          averageUtilityDmg: entry.averageUtilityDmg,
          averageEffectiveFlashes: entry.averageEffectiveFlashes,
          averageEntryAttempts: entry.averageEntryAttempts,
          averageEntryKills: entry.averageEntryKills,
          averageHeadshotsPct: entry.averageHeadshotsPct,
          multiKills: entry.multiKills,
          standoutPlayer: entry.standoutPlayer ?? "--"
        };
      }),
    [operations.recentMatches]
  );

  const multiKillData = useMemo(
    () =>
      (operations.multiKillLeaders ?? []).map((entry) => ({
        nickname: entry.nickname,
        "2K": entry.doubleKills,
        "3K": entry.tripleKills,
        "4K": entry.quadroKills,
        "5K": entry.pentaKills,
        total: entry.total
      })),
    [operations.multiKillLeaders]
  );

  const matchDayMatches = useMemo(
    () =>
      [...operations.matchDayMatches].sort((left, right) =>
        sortDateDescending(left.finishedAt, right.finishedAt)
      ),
    [operations.matchDayMatches]
  );
  const matchDayWins = matchDayMatches.filter((entry) => entry.result === "W").length;
  const matchDayLosses = matchDayMatches.filter((entry) => entry.result === "L").length;
  const matchDayMultiKills = matchDayMatches.reduce((total, entry) => total + entry.multiKills, 0);
  const hasScopedSquadStats = impactSortedPlayers.some((player) => player.stats.matchesReviewed > 0);
  const recentAdrValues = players
    .map((player) => player.stats.recentAdr)
    .filter((value): value is number => value !== null);
  const recentUtilityValues = players
    .map((player) => player.stats.recentUtilityDmg)
    .filter((value): value is number => value !== null);
  const recentEffectiveFlashValues = players
    .map((player) => player.stats.recentEffectiveFlashes)
    .filter((value): value is number => value !== null);
  const recentEntryAttemptValues = players
    .map((player) => player.stats.recentEntryAttempts)
    .filter((value): value is number => value !== null);
  const recentEntryKillValues = players
    .map((player) => player.stats.recentEntryKills)
    .filter((value): value is number => value !== null);
  const latestMvpNickname = latestMatch?.standoutPlayer ?? summary?.bestPerformer?.nickname ?? null;
  const latestMvpPlayer =
    latestMvpNickname
      ? players.find((player) => player.nickname.toLowerCase() === latestMvpNickname.toLowerCase()) ?? null
      : null;
  const latestMvpMatchFromForm =
    latestMvpPlayer && latestMatch?.matchId
      ? latestMvpPlayer.stats.form.find((match) => match.matchId === latestMatch.matchId) ?? null
      : null;
  const latestMvpMatch =
    latestMvpMatchFromForm ??
    (latestMvpPlayer?.lastMatch ? latestMvpPlayer.lastMatch : null);
  const latestMvpPeak = latestMvpMatch?.multiKillPeak ?? latestMatch?.peakMultiKill ?? 0;
  const latestMvpStatus =
    latestMvpPeak >= 4
      ? "site erasure"
      : latestMvpPeak === 3
        ? "triple entry"
        : latestMatch?.result === "W"
          ? "match breaker"
          : latestMatch?.result === "L"
            ? "reset protocol"
            : "frag watch";
  const latestMvpDetail = latestMvpMatch
    ? `${formatNumber(latestMvpMatch.kills)} kills · ${formatNumber(latestMvpMatch.kd, 2)} K/D · ${formatNumber(latestMvpMatch.adr ?? null, 0)} ADR`
    : latestMvpNickname
      ? `${latestMatch?.score ?? "--"} · ${latestMap.displayName}`
      : "Awaiting standout signal";
  const hasRecentOutput = recentOutputData.length > 0;
  const hasMultiKillOutput = multiKillData.some((entry) => entry.total > 0);
  const snackLeaderboard = snackEntries
    .map((entry) => {
      const spend = parseSnackNumber(entry.spend);
      const monsterCount = parseSnackNumber(entry.monsterCount);
      const castleScore = spend + monsterCount * SNACK_SCORE_MONSTER_MULTIPLIER;
      return {
        ...entry,
        spend,
        monsterCount,
        castleScore
      };
    })
    .sort(
      (left, right) =>
        right.castleScore - left.castleScore ||
        right.spend - left.spend ||
        right.monsterCount - left.monsterCount ||
        left.nickname.localeCompare(right.nickname)
    );
  const snackChampion = snackLeaderboard.find((entry) => entry.castleScore > 0) ?? null;
  const snackPot = snackLeaderboard.reduce((total, entry) => total + entry.spend, 0);
  const snackMonsterCount = snackLeaderboard.reduce((total, entry) => total + entry.monsterCount, 0);
  const snackEntriesWithSpend = snackLeaderboard.filter((entry) => entry.spend > 0 || entry.monsterCount > 0).length;
  const averageEloDeltaPerPlayer = useMemo(
    () => (matchDayWins - matchDayLosses) * FACEIT_ELO_STEP,
    [matchDayWins, matchDayLosses]
  );

  const summaryCards = [
    {
      label: "Squad avg ELO",
      value: formatNumber(summary?.averageElo ?? null),
      detail: `${players.length} tracked`,
      icon: Shield
    },
    {
      label: "Win rate",
      value: formatPercent(summary?.averageWinRate ?? null),
      detail: `${formatNumber(summary?.totalMatchesReviewed ?? null)} maps sampled`,
      icon: Trophy
    },
    {
      label: "Squad K/D",
      value: formatNumber(summary?.averageKd ?? null, 2),
      detail: `${formatPercent(summary?.averageHeadshotsPct ?? null)} HS`,
      icon: Target
    },
    {
      label: "Recent ADR",
      value: recentAdrValues.length > 0 ? formatNumber(recentAdrValues.reduce((sum, value) => sum + value, 0) / recentAdrValues.length, 0) : "--",
      detail:
        recentUtilityValues.length > 0
          ? `${formatNumber(recentUtilityValues.reduce((sum, value) => sum + value, 0) / recentUtilityValues.length, 0)} util dmg`
          : "utility pending",
      icon: Flame
    },
    {
      label: "Entry attempts",
      value:
        recentEntryAttemptValues.length > 0
          ? formatNumber(
              recentEntryAttemptValues.reduce((sum, value) => sum + value, 0) / recentEntryAttemptValues.length,
              1
            )
          : "--",
      detail:
        recentEntryKillValues.length > 0
          ? `${formatNumber(
              recentEntryKillValues.reduce((sum, value) => sum + value, 0) / recentEntryKillValues.length,
              1
            )} entry kills`
          : recentEffectiveFlashValues.length > 0
            ? `${formatNumber(
                recentEffectiveFlashValues.reduce((sum, value) => sum + value, 0) / recentEffectiveFlashValues.length,
                1
              )} effective flashes`
          : "flash data pending",
      icon: AlertTriangle
    },
    {
      label: "Multi-kills",
      value: formatNumber(summary?.totalMultiKills ?? null),
      detail: "2K-5K samlet",
      icon: Swords
    },
    {
      label: "Avg ELO +/- pr spiller",
      value: formatSignedNumber(averageEloDeltaPerPlayer, 0),
      detail: `${matchDayWins}W / ${matchDayLosses}L · ${formatNumber(matchDayMatches.length)} kampe`,
      icon: Shield
    },
    {
      label: `${matchDayLabel} matches`,
      value: formatNumber(matchDayMatches.length),
      detail: `${matchDayWins}W / ${matchDayLosses}L`,
      icon: CalendarDays
    }
  ];

  return (
    <main className={styles.shell}>
      <AnimatePresence>
        {isTeaserOpen ? (
          <TeaserOverlay onClose={closeTeaser} trackedNicknames={data?.trackedNicknames ?? []} />
        ) : null}
      </AnimatePresence>
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <span className={styles.brandEyebrow}>Faceit War Room</span>
          <strong>CS2 Squad Ops</strong>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={clsx(
              styles.pillButton,
              viewMode === "sonny" && styles.pillButtonActive
            )}
            onClick={() => setViewMode((m) => (m === "sonny" ? "dashboard" : "sonny"))}
          >
            {viewMode === "sonny" ? "← Dashboard" : "Visit Sunny's house party"}
          </button>
          <button
            type="button"
            className={clsx(
              styles.pillButton,
              viewMode === "tactics" && styles.pillButtonActive
            )}
            onClick={() => setViewMode((m) => (m === "tactics" ? "dashboard" : "tactics"))}
          >
            {viewMode === "tactics" ? "← Dashboard" : "Map Tactics"}
          </button>
          <button
            type="button"
            className={clsx(styles.pillButton, viewMode === "snacks" && styles.pillButtonActive)}
            onClick={() => setViewMode((m) => (m === "snacks" ? "dashboard" : "snacks"))}
          >
            {viewMode === "snacks" ? "← Dashboard" : "Snack Load"}
          </button>
          <button className={styles.primaryButton} onClick={() => void refresh()} disabled={isRefreshing}>
            {isRefreshing ? <OperatorSpinner size="sm" /> : <RefreshCw className={styles.buttonIcon} />}
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
          {orderedPlayers[0]?.faceitUrl ? (
            <a className={styles.secondaryButton} href={orderedPlayers[0].faceitUrl} rel="noreferrer" target="_blank">
              FACEIT
              <ExternalLink className={styles.buttonIcon} />
            </a>
          ) : null}
          <DashboardSettings
            lockToMatchDay={lockToMatchDay}
            onReplayTeaser={replayTeaser}
            onToggleLockToMatchDay={toggleLockToMatchDay}
            sourceLabel={sourceLabel}
            trackedNicknames={data?.trackedNicknames ?? []}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
      {viewMode === "sonny" ? (
        <motion.section
          key="sonny"
          className={styles.sonnyView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.sonnyImageWrap}>
            <img
              src={sunnyBannedImage.src}
              alt="Sunny banned"
              className={styles.sonnyImage}
            />
          </div>
          <button
            type="button"
            className={styles.booButton}
            onClick={throwBoo}
          >
            {BOO_MESSAGES[booMessageIndex]}
          </button>
        </motion.section>
      ) : viewMode === "tactics" ? (
        <motion.section
          key="tactics"
          className={styles.tacticsView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <article className={styles.tacticsCardPrimary}>
            <div className={styles.tacticsCopy}>
              <span className={styles.tacticsEyebrow}>Map Tactics</span>
              <h2>Wash toilets</h2>
              <p>Only t-site gun round tactic on Overpass...</p>
            </div>
            <div className={styles.tacticsImageWrap}>
              <img
                src={washToiletsImage.src}
                alt="Wash toilets tactic board"
                className={styles.tacticsImage}
              />
              <img
                src={cleaningImage.src}
                alt="Cleaning supplies"
                className={styles.cleaningImage}
              />
            </div>
          </article>

          <article className={styles.tacticsCardSecondary}>
            <img
              src={rushLangosImage.src}
              alt="Rush langos house route"
              className={styles.tacticsImage}
            />
            <div className={styles.wordArtWrap}>
              <span className={styles.wordArtShadow}>Rush langos house</span>
              <span className={styles.wordArt}>Rush langos house</span>
            </div>
          </article>
        </motion.section>
      ) : viewMode === "snacks" ? (
        <motion.section
          key="snacks"
          className={styles.snackView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <article className={styles.snackCastleCard}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Snack Load</h2>
              <span className={styles.sectionBadge}>
                {formatNumber(snackPot, 0)} kr · {formatNumber(snackMonsterCount, 0)} monsters
              </span>
            </div>

            <div className={styles.snackCastleLayout}>
              <div className={styles.snackChampion}>
                <span className={styles.snackEyebrow}>King of the Castle</span>
                <strong>{snackChampion?.nickname ?? "Ingen konge endnu"}</strong>
                <p>
                  {snackChampion
                    ? `${formatNumber(snackChampion.castleScore, 0)} castle score · ${formatNumber(snackChampion.spend, 0)} kr spent · ${formatNumber(snackChampion.monsterCount, 0)} monsters`
                    : "Indtast snack haul og monster-forbrug. Den højeste snack score tager kronen."}
                </p>
                <div className={styles.snackChampionMeta}>
                  <span className={styles.snackMetaPill}>
                    {snackEntriesWithSpend} loaders checked in
                  </span>
                  <span className={styles.snackMetaPill}>
                    Score = kr + monsters x {SNACK_SCORE_MONSTER_MULTIPLIER}
                  </span>
                </div>
              </div>

              <div className={styles.snackLeaderboard}>
                {snackLeaderboard.map((entry, index) => (
                  <div key={entry.nickname} className={styles.snackRankCard}>
                    <div>
                      <span className={styles.snackRankLabel}>#{index + 1}</span>
                      <strong>{entry.nickname}</strong>
                    </div>
                    <span className={styles.snackRankScore}>{formatNumber(entry.castleScore, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={styles.snackFormCard}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Supply Manifest</h2>
              <span className={styles.sectionBadge}>editable · autosaved</span>
            </div>
            <div className={styles.snackFormGrid}>
              {snackEntries.map((entry) => (
                <div key={entry.nickname} className={styles.snackInputCard}>
                  <div className={styles.snackInputHead}>
                    <div className={styles.snackInputTitle}>
                      <strong>{entry.nickname}</strong>
                      <span>{formatNumber(parseSnackNumber(entry.spend) + parseSnackNumber(entry.monsterCount) * SNACK_SCORE_MONSTER_MULTIPLIER, 0)} pts</span>
                    </div>
                    <button
                      type="button"
                      className={styles.snackClearButton}
                      onClick={() => clearSnackEntry(entry.nickname)}
                    >
                      Clear
                    </button>
                  </div>
                  <label className={styles.snackField}>
                    <span>Spent (kr)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.spend}
                      onChange={(event) => updateSnackEntry(entry.nickname, "spend", event.target.value)}
                    />
                  </label>
                  <label className={styles.snackField}>
                    <span>Monster cans</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.monsterCount}
                      onChange={(event) => updateSnackEntry(entry.nickname, "monsterCount", event.target.value)}
                    />
                  </label>
                  <label className={styles.snackField}>
                    <span>Snack haul</span>
                    <input
                      type="text"
                      value={entry.loadout}
                      placeholder="chips, candy, energy, whatever"
                      onChange={(event) => updateSnackEntry(entry.nickname, "loadout", event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </article>
        </motion.section>
      ) : (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {error ? (
        <div className={styles.alertBanner}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      {data?.missingNicknames.length ? (
        <div className={styles.noticeBanner}>
          <WifiOff size={18} />
          <span>Mangler spillerdata for: {data.missingNicknames.join(", ")}</span>
        </div>
      ) : null}

      <section className={styles.playersSection}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Players</h2>
          <span className={styles.sectionBadge}>{orderedPlayers.length} tracked</span>
        </div>

        <div className={styles.rosterGrid}>
          {orderedPlayers.map((player, index) => {
            const lastMap = getCs2MapInfo(player.lastMatch?.map ?? null);
            const previousMatch = player.stats.form.at(-2) ?? null;
            const killsDelta =
              player.lastMatch && previousMatch ? player.lastMatch.kills - previousMatch.kills : null;
            const kdDelta =
              player.lastMatch && previousMatch ? player.lastMatch.kd - previousMatch.kd : null;
            const vsPreviousLabel =
              killsDelta !== null && kdDelta !== null
                ? `${formatSignedNumber(killsDelta, 0)} K · ${formatSignedNumber(kdDelta, 2)} K/D`
                : "--";

            return (
              <motion.article
                key={player.playerId}
                className={styles.playerCard}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: index * 0.04 }}
              >
                <div className={styles.playerTop}>
                  <div className={styles.playerIdentity}>
                    <div className={styles.avatarWrap}>
                      {player.avatar ? (
                        <img alt={player.nickname} className={styles.avatar} src={player.avatar} />
                      ) : (
                        <div className={styles.avatarFallback}>{player.nickname.slice(0, 2)}</div>
                      )}
                    </div>
                    <div>
                      <p className={styles.playerName}>{player.nickname}</p>
                      <p className={styles.playerMeta}>
                        {lastMap.displayName} · {formatDateTime(player.lastMatch?.finishedAt ?? null)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.playerRank}>#{index + 1}</div>
                </div>

                <div className={styles.playerStats}>
                  <div>
                    <span>ELO</span>
                    <strong>{formatNumber(player.faceitElo)}</strong>
                  </div>
                  <div>
                    <span>Recent K/D</span>
                    <strong>{formatNumber(player.stats.recentKd, 2)}</strong>
                  </div>
                  <div>
                    <span>Career win</span>
                    <strong>{formatPercent(player.stats.lifetime.winRate)}</strong>
                  </div>
                  <div>
                    <span>Career maps</span>
                    <strong>{formatNumber(player.stats.lifetime.matches)}</strong>
                  </div>
                  <div>
                    <span>Avg kills</span>
                    <strong>{formatNumber(player.stats.recentAverageKills, 1)}</strong>
                  </div>
                  <div>
                    <span>Streak</span>
                    <strong>{formatNumber(player.stats.lifetime.currentWinStreak)}</strong>
                  </div>
                  <div>
                    <span>Vs forrige</span>
                    <strong>{vsPreviousLabel}</strong>
                  </div>
                </div>

                <div className={styles.multiKillRack}>
                  <span>2K {player.stats.multiKills.double}</span>
                  <span>3K {player.stats.multiKills.triple}</span>
                  <span>4K {player.stats.multiKills.quadro}</span>
                  <span>5K {player.stats.multiKills.penta}</span>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className={styles.heroGrid}>
        <article className={styles.heroCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Latest Match</h2>
            <span className={styles.sectionBadge}>{latestMap.code}</span>
          </div>

          <div className={styles.latestMatchCard}>
            <div className={styles.latestMatchTop}>
              <div>
                <span className={styles.mapCode}>{latestMap.code}</span>
                <h3>{latestMap.displayName}</h3>
              </div>
              <span
                className={clsx(
                  styles.resultPill,
                  latestMatch?.result === "W" && styles.resultWin,
                  latestMatch?.result === "L" && styles.resultLoss
                )}
              >
                {latestMatch?.result ?? "--"}
              </span>
            </div>

            <div className={styles.mvpSiren}>
              <div className={styles.mvpBeacon} aria-hidden>
                <span className={styles.mvpBeaconPulse} />
                <span className={styles.mvpBeaconCore} />
              </div>
              <div className={styles.mvpSirenCopy}>
                <span className={styles.mvpSirenEyebrow}>MVP siren</span>
                <strong>{latestMvpNickname ?? "--"}</strong>
                <small>{latestMvpDetail}</small>
              </div>
              <div className={styles.mvpSirenMeta}>
                <span className={styles.mvpMetaPill}>{latestMvpStatus}</span>
                <span className={styles.mvpMetaPill}>{formatPeakLabel(latestMvpPeak)}</span>
              </div>
            </div>

            <div className={styles.latestMatchStats}>
              <div>
                <span>Score</span>
                <strong>{latestMatch?.score ?? "--"}</strong>
              </div>
              <div>
                <span>Standout</span>
                <strong>{latestMatch?.standoutPlayer ?? "--"}</strong>
              </div>
              <div>
                <span>Avg kills</span>
                <strong>{formatNumber(latestMatch?.averageKills ?? null, 1)}</strong>
              </div>
              <div>
                <span>Avg K/D</span>
                <strong>{formatNumber(latestMatch?.averageKd ?? null, 2)}</strong>
              </div>
              <div>
                <span>Avg ADR</span>
                <strong>{formatNumber(latestMatch?.averageAdr ?? null, 0)}</strong>
              </div>
              <div>
                <span>Multi-kills</span>
                <strong>{formatNumber(latestMatch?.multiKills ?? null)}</strong>
              </div>
              <div>
                <span>Eff. flashes</span>
                <strong>{formatNumber(latestMatch?.averageEffectiveFlashes ?? null, 1)}</strong>
              </div>
              <div>
                <span>Entry attempts</span>
                <strong>{formatNumber(latestMatch?.averageEntryAttempts ?? null, 1)}</strong>
              </div>
              <div>
                <span>Entry kills</span>
                <strong>{formatNumber(latestMatch?.averageEntryKills ?? null, 1)}</strong>
              </div>
            </div>

            <div className={styles.statusRow}>
              <span className={styles.inlineStat}>{latestMatch?.competition ?? "FACEIT"}</span>
              <span className={styles.inlineStat}>{formatDateTime(latestMatch?.finishedAt ?? null)}</span>
              <span className={styles.inlineStat}>
                {formatPercent(latestMatch?.averageHeadshotsPct ?? null)} HS · {formatNumber(latestMatch?.averageKr ?? null, 2)} K/R
              </span>
            </div>
          </div>
        </article>

        <article className={styles.snapshotCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Squad Snapshot</h2>
            <span className={styles.sectionBadge}>{status === "ready" ? "READY" : "BOOT"}</span>
          </div>

          <div className={styles.summaryGrid}>
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={styles.metricCard}>
                  <div className={styles.metricTop}>
                    <span>{card.label}</span>
                    <Icon size={16} />
                  </div>
                  <div className={styles.metricBottom}>
                    <p className={styles.metricValue}>{card.value}</p>
                    <p className={styles.metricDetail}>{card.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.chartCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Recent Output</h2>
            <span className={styles.sectionBadge}>{operations.recentMatches.length} matches</span>
          </div>
          {hasRecentOutput ? (
            <>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={recentOutputData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(245,240,236,0.62)" />
                    <YAxis yAxisId="kills" stroke="rgba(245,240,236,0.62)" />
                    <YAxis yAxisId="kd" orientation="right" stroke="rgba(245,240,236,0.48)" domain={[0, "auto"]} />
                    <Tooltip
                      labelFormatter={(_, payload) => {
                        const entry = payload?.[0]?.payload;
                        return entry ? `${entry.mapName} · ${formatDateTime(entry.finishedAt)}` : "FACEIT";
                      }}
                      formatter={(value, name, item) => {
                        if (name === "Avg K/D") {
                          return [`${value}`, `${name} · ${item.payload.score}`];
                        }

                        return [`${value}`, `${name} · ${item.payload.standoutPlayer}`];
                      }}
                      contentStyle={{
                        background: "rgba(9, 9, 11, 0.94)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "16px"
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="kills" dataKey="averageKills" name="Avg kills" radius={[10, 10, 0, 0]} isAnimationActive={false}>
                      {recentOutputData.map((entry) => (
                        <Cell
                          key={`${entry.key}-kills`}
                          fill={entry.result === "W" ? "#ffb15e" : entry.result === "L" ? "#ff5c42" : "#d98b70"}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="kd"
                      type="monotone"
                      dataKey="averageKd"
                      name="Avg K/D"
                      stroke="#ffe29b"
                      strokeWidth={3}
                      isAnimationActive={false}
                      dot={{ r: 4, fill: "#ffe29b", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.signalList}>
                {recentOutputData.slice(0, 3).map((entry) => (
                  <div key={`${entry.key}-signal`} className={styles.signalItem}>
                    <span>{entry.mapName}</span>
                    <strong>{formatNumber(entry.averageAdr ?? null, 0)} ADR</strong>
                    <small>
                      {formatNumber(entry.averageKd, 2)} K/D · {formatPercent(entry.averageHeadshotsPct)} HS
                    </small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              Ingen recent output endnu i det valgte scope. Refresh efter næste kamp for at se form-grafen.
            </div>
          )}
        </article>

        <article className={styles.chartCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Multi-Kill Stack</h2>
            <span className={styles.sectionBadge}>{formatNumber(summary?.totalMultiKills ?? null)} total</span>
          </div>
          {hasMultiKillOutput ? (
            <>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={multiKillData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="nickname" stroke="rgba(245,240,236,0.62)" />
                    <YAxis stroke="rgba(245,240,236,0.62)" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(9, 9, 11, 0.94)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "16px"
                      }}
                    />
                    <Legend />
                    <Bar dataKey="2K" stackId="kills" fill="#ff6b4a" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="3K" stackId="kills" fill="#ff9954" isAnimationActive={false} />
                    <Bar dataKey="4K" stackId="kills" fill="#f2c870" isAnimationActive={false} />
                    <Bar dataKey="5K" stackId="kills" fill="#ffe4a2" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.multiKillList}>
                {operations.multiKillLeaders.slice(0, 3).map((entry) => (
                  <div key={`${entry.nickname}-multi`} className={styles.multiKillLead}>
                    <span>{entry.nickname}</span>
                    <strong>{entry.total}</strong>
                    <small>{formatPeakLabel(entry.peak)}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              Ingen multi-kills registreret i det valgte scope endnu.
            </div>
          )}
        </article>
      </section>

      <div className={styles.mainWithSidebar}>
        <div className={styles.mainContent}>
      <section className={styles.detailGrid}>
        <article className={styles.tableCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Match Day · {matchDayLabel}</h2>
            <span className={styles.sectionBadge}>
              {matchDayMatches.length} matches · {matchDayMultiKills} multi-kills
            </span>
          </div>

          {matchDayMatches.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.matchTable}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Map</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Avg kills</th>
                    <th>Avg K/D</th>
                    <th>Avg ADR</th>
                    <th>Eff. flashes</th>
                    <th>Entry attempts</th>
                    <th>Entry kills</th>
                    <th>Multi</th>
                    <th>Standout</th>
                  </tr>
                </thead>
                <tbody>
                  {matchDayMatches.map((entry) => {
                    const mapInfo = getCs2MapInfo(entry.map);
                    return (
                      <tr key={entry.matchId}>
                        <td>{formatDateTime(entry.finishedAt)}</td>
                        <td>
                          <span className={styles.tableMapCode}>{mapInfo.code}</span>
                          <strong>{mapInfo.displayName}</strong>
                        </td>
                        <td>{entry.score ?? "--"}</td>
                        <td>
                          <span
                            className={clsx(
                              styles.resultMini,
                              entry.result === "W" && styles.resultWin,
                              entry.result === "L" && styles.resultLoss
                            )}
                          >
                            {entry.result}
                          </span>
                        </td>
                        <td>{formatNumber(entry.averageKills, 1)}</td>
                        <td>{formatNumber(entry.averageKd, 2)}</td>
                        <td>{formatNumber(entry.averageAdr ?? null, 0)}</td>
                        <td>{formatNumber(entry.averageEffectiveFlashes ?? null, 1)}</td>
                        <td>{formatNumber(entry.averageEntryAttempts ?? null, 1)}</td>
                        <td>{formatNumber(entry.averageEntryKills ?? null, 1)}</td>
                        <td>{entry.multiKills}</td>
                        <td>{entry.standoutPlayer ?? "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Ingen kampe registreret for dagens dato endnu. Tabellen fyldes, når der er FACEIT-kampe i dag.
            </div>
          )}
        </article>
      </section>

      <section className={styles.hardcoreSection}>
        <article className={styles.tableCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Player Form</h2>
            <span className={styles.sectionBadge}>
              {lockToMatchDay ? "Dagens dato scope" : "Impact · ADR · HS"}
            </span>
          </div>

          {hasScopedSquadStats ? (
            <div className={styles.tableWrap}>
              <table className={styles.matchTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Maps</th>
                    <th>Impact</th>
                    <th>HS%</th>
                    <th>K/D</th>
                    <th>K/R</th>
                    <th>Avg kills</th>
                    <th>ADR</th>
                    <th>Utility dmg</th>
                    <th>Eff. flashes</th>
                    <th>Entry att.</th>
                    <th>Entry kills</th>
                    <th>Multi</th>
                  </tr>
                </thead>
                <tbody>
                  {impactSortedPlayers.map((player, index) => {
                    const hasPlayerData = player.stats.matchesReviewed > 0;

                    return (
                      <tr key={player.playerId}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{player.nickname}</strong>
                        </td>
                        <td>{player.stats.matchesReviewed}</td>
                        <td>{hasPlayerData ? formatNumber(player.impactScore, 1) : "--"}</td>
                        <td>{hasPlayerData ? formatPercent(player.stats.recentHeadshotsPct) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentKd, 2) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentKr, 2) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentAverageKills, 1) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentAdr ?? null, 0) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentUtilityDmg ?? null, 0) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentEffectiveFlashes ?? null, 1) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentEntryAttempts ?? null, 1) : "--"}</td>
                        <td>{hasPlayerData ? formatNumber(player.stats.recentEntryKills ?? null, 1) : "--"}</td>
                        <td>{hasPlayerData ? player.stats.multiKills.total : "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              {lockToMatchDay
                ? "Ingen squad stats for dagens dato endnu. Day lock er aktiv, så tabellen fyldes først når dagens FACEIT-kampe er hentet."
                : "Ingen squad stats endnu. Refresh efter første kamp for at fylde tabellen."}
            </div>
          )}
        </article>
      </section>
        </div>

        <aside className={styles.mapSidebar}>
          <article className={styles.mapCard}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Map Control</h2>
              <span className={styles.sectionBadge}>{operations.mapPerformance.length} maps</span>
            </div>

            {operations.mapPerformance.length > 0 ? (
              <div className={styles.mapControlList}>
                {operations.mapPerformance.map((entry) => {
                  const mapInfo = getCs2MapInfo(entry.map);
                  return (
                    <div key={`${entry.map}-${entry.lastPlayedAt ?? "none"}`} className={styles.mapControlItem}>
                      <div className={styles.mapControlTop}>
                        <div>
                          <span className={styles.mapCode}>{mapInfo.code}</span>
                          <strong>{mapInfo.displayName}</strong>
                        </div>
                        <small>{formatDateTime(entry.lastPlayedAt)}</small>
                      </div>
                      <div className={styles.mapControlStats}>
                        <span>{formatPercent(entry.winRate)} win</span>
                        <span>{formatNumber(entry.averageKd, 2)} K/D</span>
                        <span>{formatNumber(entry.averageAdr ?? null, 0)} ADR</span>
                        <span>{entry.multiKills} multi</span>
                      </div>
                      <div className={styles.mapControlMeter}>
                        <span style={{ width: `${Math.max(8, Math.min(100, entry.winRate))}%` }} />
                      </div>
                      <p className={styles.mapControlMeta}>
                        {entry.matches} maps · standout {entry.standoutPlayer ?? "--"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                Ingen map control-data i det valgte scope endnu.
              </div>
            )}
          </article>
        </aside>
      </div>
        </motion.div>
      )}
      </AnimatePresence>

      <footer className={clsx(styles.footer, viewMode !== "dashboard" && styles.footerHidden)}>
        <div className={styles.footerPills}>
          <span className={clsx(styles.pill, source === "live" && styles.pillLive, source === "cache" && styles.pillCache)}>
            {sourceLabel}
          </span>
          <span className={styles.pill}>
            Sync: {syncStamp ? `${formatAgo(syncStamp)} · ${formatDateTime(syncStamp)}` : "afventer"}
          </span>
          <span className={styles.pill}>Latest map: {latestMap.displayName}</span>
          <span className={styles.pill}>07.03: {matchDayMatches.length} matches</span>
          <span className={clsx(styles.pill, lockToMatchDay && styles.pillLive)}>
            {lockToMatchDay ? "Locked: dagens dato" : "Scope: all recent"}
          </span>
          <span className={styles.pill}>Tracked: {data?.trackedNicknames.length ?? 5}</span>
        </div>
      </footer>

      <div className={styles.booContainer} aria-hidden>
        {booReactions.map(({ id, x, y, text }) => (
          <motion.span
            key={id}
            className={styles.booReaction}
            initial={{ opacity: 1, y: 0, scale: 0.6, x: "-50%" }}
            animate={{ opacity: 0, y: -220, scale: 1.15, x: "-50%" }}
            transition={{ duration: 2.8, ease: "easeOut" }}
            style={{ left: x, top: y }}
            onAnimationComplete={() =>
              setBooReactions((prev) => prev.filter((r) => r.id !== id))
            }
          >
            {text}
          </motion.span>
        ))}
      </div>
    </main>
  );
}
