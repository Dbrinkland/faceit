import type {
  DashboardSummary,
  FaceitDashboardResponse,
  PlayerFormMatch,
  PlayerHighlight,
  PlayerHistoryEntry,
  PlayerLifetimeStats,
  PlayerMultiKillSummary,
  PlayerSnapshot,
  SquadMapPerformance,
  SquadRecentMatch
} from "@/lib/types";
import { normalizeCs2MapName } from "@/lib/cs2";

const FACEIT_BASE_URL = "https://open.faceit.com/data/v4";
const DEFAULT_NICKNAMES = ["v1rtux", "C10_dk", "OllieReed", "N-hat", "Wond3r_"];
const RECENT_MATCH_LIMIT = 10;
const HISTORY_LIMIT = 10;
const MATCH_DAY_LIMIT = 20;
const MATCH_DAY_TIME_ZONE = "Europe/Copenhagen";

type JsonRecord = Record<string, unknown>;
type MatchEnrichment = {
  map: string | null;
  competition: string | null;
  score: string | null;
  finishedAt: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized || normalized === "-") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isNaN(numeric) && /^\d+$/.test(value)) {
    return toIsoDate(numeric);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortDateDescending(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  return utcGuess - offset;
}

function getMatchDayWindow(now = new Date(), timeZone = MATCH_DAY_TIME_ZONE) {
  const { year, month, day } = getDatePartsInTimeZone(now, timeZone);
  const from = zonedDateTimeToUtcMs(year, month, day, 0, 0, 0, 0, timeZone);
  const to = zonedDateTimeToUtcMs(year, month, day, 23, 59, 59, 999, timeZone);
  return { from, to };
}

function pickString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const result = asString(record[key]);
    if (result !== null) {
      return result;
    }
  }

  return null;
}

function pickNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const result = asNumber(record[key]);
    if (result !== null) {
      return result;
    }
  }

  return null;
}

/** Find numeric value by scanning object keys for substring match (case-insensitive). */
function pickNumberByKeyPattern(record: JsonRecord, patterns: string[]): number | null {
  for (const [key, value] of Object.entries(record)) {
    if (typeof key !== "string") continue;
    const keyLower = key.toLowerCase();
    for (const pattern of patterns) {
      if (keyLower.includes(pattern.toLowerCase())) {
        const num = asNumber(value);
        if (num !== null && num >= 0) return num;
      }
    }
  }
  return null;
}

/** Recursively search for advanced round stats in nested structures (max depth 3). */
function findDamageStats(
  obj: unknown,
  depth: number
): {
  adr: number | null;
  utilityDmg: number | null;
  effectiveFlashes: number | null;
  entryAttempts: number | null;
} {
  if (depth > 3 || obj === null || typeof obj !== "object") {
    return { adr: null, utilityDmg: null, effectiveFlashes: null, entryAttempts: null };
  }
  const record = obj as JsonRecord;
  const adr =
    pickNumber(record, ["Average Damage per Round", "Average Damage", "ADR"]) ??
    pickNumberByKeyPattern(record, ["average damage", "adr"]) ??
    null;
  const utilityDmg =
    pickNumber(record, ["Utility Damage", "Average Utility Damage", "Utility Damage per Round"]) ??
    pickNumberByKeyPattern(record, ["utility damage", "utility"]) ??
    null;
  const effectiveFlashes =
    pickNumber(record, [
      "Effective flashes",
      "Effective Flashes",
      "Effective Flash",
      "Flashes Effective",
      "Effective flash assists"
    ]) ??
    pickNumberByKeyPattern(record, ["effective flashes", "effective flash", "flash assists"]) ??
    null;
  const entryAttempts =
    pickNumber(record, [
      "Entry Attempts",
      "Entry attempts",
      "Entry attempt",
      "Entry duels attempted",
      "Entry Duels Attempted",
      "Opening duels attempted",
      "Attempted Entries",
      "Attempted Entry",
      "Opening attempts",
      "Opening Attempts"
    ]) ??
    pickNumberByKeyPattern(
      record,
      [
        "entry attempts",
        "entry attempt",
        "entry duels attempted",
        "opening duels attempted",
        "attempted entries",
        "attempted entry",
        "opening attempts",
        "opening attempt"
      ]
    ) ??
    null;

  if (adr !== null && utilityDmg !== null && effectiveFlashes !== null && entryAttempts !== null) {
    return { adr, utilityDmg, effectiveFlashes, entryAttempts };
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = findDamageStats(value, depth + 1);
      if (
        nested.adr !== null ||
        nested.utilityDmg !== null ||
        nested.effectiveFlashes !== null ||
        nested.entryAttempts !== null
      ) {
        return {
          adr: nested.adr ?? adr,
          utilityDmg: nested.utilityDmg ?? utilityDmg,
          effectiveFlashes: nested.effectiveFlashes ?? effectiveFlashes,
          entryAttempts: nested.entryAttempts ?? entryAttempts
        };
      }
    }
  }
  return { adr, utilityDmg, effectiveFlashes, entryAttempts };
}

function resolveMapName(value: unknown): string | null {
  const direct = asString(value);
  if (!direct) {
    return null;
  }

  return normalizeCs2MapName(direct);
}

function findMapName(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  const direct = resolveMapName(value);
  if (direct) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findMapName(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const prioritizedKeys = [
    "game_map",
    "gameMap",
    "map",
    "Map",
    "picked_map",
    "best_of",
    "voting"
  ];

  for (const key of prioritizedKeys) {
    const nested = findMapName(value[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (/map/i.test(key)) {
      const nested = findMapName(nestedValue, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findMapName(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeResult(value: string | null): "W" | "L" | "?" {
  if (!value) {
    return "?";
  }

  const normalized = value.toLowerCase();
  if (
    normalized === "1" ||
    normalized === "w" ||
    normalized.includes("win") ||
    normalized.includes("victory")
  ) {
    return "W";
  }

  if (
    normalized === "0" ||
    normalized === "l" ||
    normalized.includes("loss") ||
    normalized.includes("defeat")
  ) {
    return "L";
  }

  return "?";
}

function formatScore(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  const direct = asString(record.score);
  if (direct) {
    return direct;
  }

  const faction1 = asNumber(record.faction1 ?? record.team1 ?? record.home);
  const faction2 = asNumber(record.faction2 ?? record.team2 ?? record.away);
  if (faction1 !== null && faction2 !== null) {
    return `${faction1}:${faction2}`;
  }

  return null;
}

async function faceitFetch<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${FACEIT_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`FACEIT ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function getFaceitApiKey() {
  return process.env.server_side_key ?? process.env.client_side_key ?? null;
}

function getTrackedNicknames() {
  const fromEnv = process.env.FACEIT_NICKNAMES
    ?.split(",")
    .map((nickname) => nickname.trim())
    .filter(Boolean);

  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_NICKNAMES;
}

async function fetchPlayerByNickname(nickname: string, apiKey: string) {
  try {
    return await faceitFetch<JsonRecord>(`/players?nickname=${encodeURIComponent(nickname)}`, apiKey);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("404")) {
      throw error;
    }

    const search = await faceitFetch<{ items?: unknown[] }>(
      `/search/players?nickname=${encodeURIComponent(nickname)}&offset=0&limit=1`,
      apiKey
    );

    const firstResult = search.items?.find(isRecord);
    const playerId = firstResult ? asString(firstResult.player_id) : null;
    if (!playerId) {
      throw new Error(`Kunne ikke finde FACEIT-spilleren "${nickname}".`);
    }

    return faceitFetch<JsonRecord>(`/players/${playerId}`, apiKey);
  }
}

function resolveGameId(player: JsonRecord) {
  const games = asRecord(player.games);
  const preferred = ["cs2", "csgo"].find((gameId) => isRecord(games[gameId]));
  if (preferred) {
    return preferred;
  }

  const firstGame = Object.keys(games)[0];
  return firstGame ?? "cs2";
}

function mapHistoryEntry(item: JsonRecord): PlayerHistoryEntry {
  const results = asRecord(item.results);
  const winner = asString(results.winner ?? item.result);

  return {
    matchId: asString(item.match_id ?? item.matchId) ?? "unknown",
    finishedAt: toIsoDate(item.finished_at ?? item.finishedAt ?? item.started_at),
    competition:
      asString(item.competition_name) ??
      asString(item.championship_name) ??
      asString(item.organizer_name) ??
      asString(item.game_mode),
    map: findMapName(item.game_map ?? item.map ?? item.voting ?? item),
    result: winner,
    score: formatScore(results.score ?? item.score ?? results)
  };
}

function mapFormItem(item: JsonRecord, fallback: PlayerHistoryEntry | undefined, index: number): PlayerFormMatch {
  const stats = asRecord(item.stats);
  const roundStats = asRecord(item.round_stats ?? stats);
  const matchId = asString(item.match_id ?? item.matchId) ?? fallback?.matchId ?? null;

  const kills = pickNumber(stats, ["Kills", "kills"]) ?? 0;
  const assists = pickNumber(stats, ["Assists", "assists"]) ?? 0;
  const deaths = pickNumber(stats, ["Deaths", "deaths"]) ?? 0;
  const kd =
    pickNumber(stats, ["K/D Ratio", "KD Ratio", "Average K/D Ratio", "Average KD Ratio"]) ??
    (deaths > 0 ? kills / deaths : kills);
  const kr = pickNumber(stats, ["K/R Ratio", "KR Ratio", "Average KR Ratio"]) ?? 0;
  const headshotsPct =
    pickNumber(stats, ["Headshots %", "HS %", "Average Headshots %", "Average HS %"]) ?? 0;
  const damageFromItem = findDamageStats(item, 0);
  const adr =
    pickNumber(stats, [
      "Average Damage per Round",
      "Average Damage",
      "ADR",
      "Damage per Round",
      "Average Damage/Round"
    ]) ??
    pickNumberByKeyPattern(stats, ["average damage", "adr", "damage per round"]) ??
    damageFromItem.adr ??
    (() => {
      const totalDmg =
        pickNumber(stats, ["Total Damage", "Damage"]) ??
        pickNumberByKeyPattern(stats, ["total damage", "damage"]);
      const rounds =
        pickNumber(stats, ["Rounds", "Rounds Played", "Matches Played"]) ??
        pickNumberByKeyPattern(stats, ["rounds", "matches"]);
      if (totalDmg !== null && rounds !== null && rounds > 0) {
        return round(totalDmg / rounds, 0);
      }
      return null;
    })();
  const utilityDmg =
    pickNumber(stats, [
      "Utility Damage",
      "Utility Damage Total",
      "Average Utility Damage",
      "Utility Damage per Round",
      "Average Utility Damage per Round"
    ]) ??
    pickNumberByKeyPattern(stats, ["utility damage", "utility dmg", "utility"]) ??
    damageFromItem.utilityDmg ??
    null;
  const effectiveFlashes =
    pickNumber(stats, ["Effective flashes", "Effective Flashes", "Effective Flash", "Flashes Effective"]) ??
    pickNumberByKeyPattern(stats, ["effective flashes", "effective flash", "flash assists"]) ??
    damageFromItem.effectiveFlashes ??
    null;
  const entryAttempts =
    pickNumber(stats, [
      "Entry Attempts",
      "Entry attempts",
      "Entry attempt",
      "Entry duels attempted",
      "Opening duels attempted",
      "Attempted Entries",
      "Attempted Entry",
      "Opening attempts",
      "Opening Attempts"
    ]) ??
    pickNumberByKeyPattern(
      stats,
      [
        "entry attempts",
        "entry attempt",
        "entry duels attempted",
        "opening duels attempted",
        "attempted entries",
        "attempted entry",
        "opening attempts",
        "opening attempt"
      ]
    ) ??
    damageFromItem.entryAttempts ??
    null;
  const doubleKills = pickNumber(stats, ["Double Kills"]) ?? 0;
  const tripleKills = pickNumber(stats, ["Triple Kills"]) ?? 0;
  const quadroKills = pickNumber(stats, ["Quadro Kills"]) ?? 0;
  const pentaKills = pickNumber(stats, ["Penta Kills"]) ?? 0;
  const result =
    normalizeResult(
      pickString(stats, ["Result", "result"]) ??
        pickString(roundStats, ["Winner", "winner"]) ??
        fallback?.result ??
        null
    ) ?? "?";

  const multiKillPeak = pentaKills > 0 ? 5 : quadroKills > 0 ? 4 : tripleKills > 0 ? 3 : doubleKills > 0 ? 2 : 0;

  return {
    matchIndex: index + 1,
    matchId,
    startedAt: toIsoDate(item.started_at ?? item.startedAt ?? fallback?.finishedAt),
    finishedAt: toIsoDate(item.finished_at ?? item.finishedAt ?? fallback?.finishedAt),
    map:
      findMapName(pickString(stats, ["Map", "map"])) ??
      findMapName(pickString(roundStats, ["Map", "map"])) ??
      fallback?.map ??
      null,
    competition: fallback?.competition ?? null,
    score: fallback?.score ?? null,
    result,
    kills,
    assists,
    deaths,
    kd: round(kd, 2),
    kr: round(kr, 2),
    headshotsPct: round(headshotsPct, 1),
    doubleKills,
    tripleKills,
    quadroKills,
    pentaKills,
    multiKillPeak,
    adr: adr !== null ? round(adr, 0) : null,
    utilityDmg: utilityDmg !== null ? round(utilityDmg, 0) : null,
    effectiveFlashes: effectiveFlashes !== null ? round(effectiveFlashes, 1) : null,
    entryAttempts: entryAttempts !== null ? round(entryAttempts, 1) : null
  };
}

async function fetchMatchEnrichment(matchId: string, apiKey: string): Promise<MatchEnrichment> {
  const [detailsResult, statsResult] = await Promise.allSettled([
    faceitFetch<JsonRecord>(`/matches/${matchId}`, apiKey),
    faceitFetch<JsonRecord>(`/matches/${matchId}/stats`, apiKey)
  ]);

  const details = detailsResult.status === "fulfilled" ? detailsResult.value : null;
  const stats = statsResult.status === "fulfilled" ? statsResult.value : null;

  const detailResults = details ? asRecord(details.results) : {};
  const rounds = stats ? asArray(stats.rounds ?? stats.items) : [];
  const firstRound = rounds.find(isRecord) ? asRecord(rounds.find(isRecord)) : {};
  const roundStats = asRecord(firstRound.round_stats);

  return {
    map:
      findMapName(firstRound) ??
      findMapName(roundStats) ??
      findMapName(details?.voting) ??
      findMapName(details?.match_results) ??
      findMapName(details) ??
      null,
    competition:
      asString(details?.competition_name) ??
      asString(details?.organizer_name) ??
      asString(details?.game_mode) ??
      null,
    score:
      formatScore(detailResults.score ?? details?.score ?? detailResults) ??
      formatScore(roundStats.Score ?? roundStats.score) ??
      null,
    finishedAt:
      toIsoDate(details?.finished_at ?? details?.finishedAt) ??
      toIsoDate(firstRound.finished_at ?? firstRound.finishedAt) ??
      null
  };
}

function applyMatchEnrichment(player: PlayerSnapshot, matchLookup: Map<string, MatchEnrichment>) {
  const nextHistory = player.history.map((entry) => {
    const enrichment = matchLookup.get(entry.matchId);
    if (!enrichment) {
      return entry;
    }

    return {
      ...entry,
      map: entry.map ?? enrichment.map,
      competition: entry.competition ?? enrichment.competition,
      score: entry.score ?? enrichment.score,
      finishedAt: entry.finishedAt ?? enrichment.finishedAt
    };
  });

  const nextHistoryById = new Map(nextHistory.map((entry) => [entry.matchId, entry]));
  const nextForm = player.stats.form.map((match) => {
    const enrichment = match.matchId ? matchLookup.get(match.matchId) : null;
    const fallback = match.matchId ? nextHistoryById.get(match.matchId) : undefined;

    return {
      ...match,
      map: match.map ?? enrichment?.map ?? fallback?.map ?? null,
      competition: match.competition ?? enrichment?.competition ?? fallback?.competition ?? null,
      score: match.score ?? enrichment?.score ?? fallback?.score ?? null,
      finishedAt: match.finishedAt ?? enrichment?.finishedAt ?? fallback?.finishedAt ?? null
    };
  });

  const nextMatchDayForm = player.stats.matchDayForm.map((match) => {
    const enrichment = match.matchId ? matchLookup.get(match.matchId) : null;
    const fallback = match.matchId ? nextHistoryById.get(match.matchId) : undefined;

    return {
      ...match,
      map: match.map ?? enrichment?.map ?? fallback?.map ?? null,
      competition: match.competition ?? enrichment?.competition ?? fallback?.competition ?? null,
      score: match.score ?? enrichment?.score ?? fallback?.score ?? null,
      finishedAt: match.finishedAt ?? enrichment?.finishedAt ?? fallback?.finishedAt ?? null
    };
  });

  return {
    ...player,
    lastMatch: nextForm.at(-1) ?? nextMatchDayForm.at(-1) ?? null,
    stats: {
      ...player.stats,
      form: nextForm,
      matchDayForm: nextMatchDayForm
    },
    history: nextHistory
  };
}

function buildOperations(players: PlayerSnapshot[]): {
  recentMatches: SquadRecentMatch[];
  matchDayMatches: SquadRecentMatch[];
  mapPerformance: SquadMapPerformance[];
  multiKillLeaders: PlayerMultiKillSummary[];
} {
  const aggregateMatches = (selector: (player: PlayerSnapshot) => PlayerFormMatch[]) => {
    const matches = new Map<
      string,
      {
        matchId: string;
        finishedAt: string | null;
        competition: string | null;
        map: string | null;
        score: string | null;
        result: "W" | "L" | "?";
        players: Array<{
          nickname: string;
          kills: number;
          kd: number;
          kr: number;
          headshotsPct: number;
          adr: number | null;
          utilityDmg: number | null;
          effectiveFlashes: number | null;
          entryAttempts: number | null;
          doubleKills: number;
          tripleKills: number;
          quadroKills: number;
          pentaKills: number;
          multiKillPeak: number;
        }>;
      }
    >();

    for (const player of players) {
      for (const match of selector(player)) {
        if (!match.matchId) {
          continue;
        }

        const current = matches.get(match.matchId) ?? {
          matchId: match.matchId,
          finishedAt: match.finishedAt,
          competition: match.competition,
          map: match.map,
          score: match.score,
          result: match.result,
          players: []
        };

        current.finishedAt = current.finishedAt ?? match.finishedAt;
        current.competition = current.competition ?? match.competition;
        current.map = current.map ?? match.map;
        current.score = current.score ?? match.score;
        current.players.push({
          nickname: player.nickname,
          kills: match.kills,
          kd: match.kd,
          kr: match.kr,
          headshotsPct: match.headshotsPct,
          adr: match.adr,
          utilityDmg: match.utilityDmg,
          effectiveFlashes: match.effectiveFlashes,
          entryAttempts: match.entryAttempts,
          doubleKills: match.doubleKills,
          tripleKills: match.tripleKills,
          quadroKills: match.quadroKills,
          pentaKills: match.pentaKills,
          multiKillPeak: match.multiKillPeak
        });
        matches.set(match.matchId, current);
      }
    }

    return Array.from(matches.values())
      .sort((left, right) => sortDateDescending(left.finishedAt, right.finishedAt))
      .map<SquadRecentMatch>((entry) => {
        const averageKills = average(entry.players.map((player) => player.kills));
        const averageKd = average(entry.players.map((player) => player.kd));
        const averageKr = average(entry.players.map((player) => player.kr));
        const averageHeadshotsPct = average(entry.players.map((player) => player.headshotsPct));
        const adrValues = entry.players
          .map((player) => player.adr)
          .filter((value): value is number => value !== null);
        const utilityValues = entry.players
          .map((player) => player.utilityDmg)
          .filter((value): value is number => value !== null);
        const effectiveFlashValues = entry.players
          .map((player) => player.effectiveFlashes)
          .filter((value): value is number => value !== null);
        const entryAttemptValues = entry.players
          .map((player) => player.entryAttempts)
          .filter((value): value is number => value !== null);
        const multiKills = sum(
          entry.players.map(
            (player) => player.doubleKills + player.tripleKills + player.quadroKills + player.pentaKills
          )
        );
        const peakMultiKill = Math.max(...entry.players.map((player) => player.multiKillPeak), 0);
        const standout = entry.players
          .slice()
          .sort(
            (left, right) =>
              right.kills + right.kd * 8 + right.multiKillPeak * 5 - (left.kills + left.kd * 8 + left.multiKillPeak * 5)
          )[0];

        return {
          matchId: entry.matchId,
          finishedAt: entry.finishedAt,
          competition: entry.competition,
          map: entry.map,
          score: entry.score,
          result: entry.result,
          trackedPlayers: entry.players.length,
          averageKills: round(averageKills, 1),
          averageKd: round(averageKd, 2),
          averageKr: round(averageKr, 2),
          averageHeadshotsPct: round(averageHeadshotsPct, 1),
          averageAdr: adrValues.length > 0 ? round(average(adrValues), 0) : null,
          averageUtilityDmg: utilityValues.length > 0 ? round(average(utilityValues), 0) : null,
          averageEffectiveFlashes:
            effectiveFlashValues.length > 0 ? round(average(effectiveFlashValues), 1) : null,
          averageEntryAttempts:
            entryAttemptValues.length > 0 ? round(average(entryAttemptValues), 1) : null,
          multiKills,
          peakMultiKill,
          standoutPlayer: standout?.nickname ?? null
        };
      });
  };

  const recentMatches = aggregateMatches((player) => player.stats.form).slice(0, 6);
  const matchDayMatches = aggregateMatches((player) => player.stats.matchDayForm);

  const maps = new Map<
    string,
    {
      map: string;
      matches: number;
      wins: number;
      kills: number[];
      kd: number[];
      headshotsPct: number[];
      adr: number[];
      multiKills: number;
      lastPlayedAt: string | null;
      players: Map<string, { kills: number[]; kd: number[] }>;
    }
  >();

  for (const player of players) {
    for (const match of player.stats.form) {
      if (!match.map) {
        continue;
      }

      const key = normalizeCs2MapName(match.map);
      const current = maps.get(key) ?? {
        map: key,
        matches: 0,
        wins: 0,
        kills: [] as number[],
        kd: [] as number[],
        headshotsPct: [] as number[],
        adr: [] as number[],
        multiKills: 0,
        lastPlayedAt: null,
        players: new Map()
      };

      current.matches += 1;
      current.wins += match.result === "W" ? 1 : 0;
      current.kills.push(match.kills);
      current.kd.push(match.kd);
      current.headshotsPct.push(match.headshotsPct);
      if (match.adr !== null) {
        current.adr.push(match.adr);
      }
      current.multiKills += match.doubleKills + match.tripleKills + match.quadroKills + match.pentaKills;
      current.lastPlayedAt =
        !current.lastPlayedAt || sortDateDescending(current.lastPlayedAt, match.finishedAt) > 0
          ? match.finishedAt
          : current.lastPlayedAt;

      const playerStats = current.players.get(player.nickname) ?? { kills: [], kd: [] };
      playerStats.kills.push(match.kills);
      playerStats.kd.push(match.kd);
      current.players.set(player.nickname, playerStats);
      maps.set(key, current);
    }
  }

  const mapPerformance = Array.from(maps.values())
    .map<SquadMapPerformance>((entry) => {
      const standout = Array.from(entry.players.entries())
        .map(([nickname, stats]) => ({
          nickname,
          score: average(stats.kills) * 2 + average(stats.kd) * 20
        }))
        .sort((left, right) => right.score - left.score)[0];

      return {
        map: entry.map,
        matches: entry.matches,
        winRate: round((entry.wins / entry.matches) * 100, 1),
        averageKills: round(average(entry.kills), 1),
        averageKd: round(average(entry.kd), 2),
        averageHeadshotsPct: round(average(entry.headshotsPct), 1),
        averageAdr: entry.adr.length > 0 ? round(average(entry.adr), 0) : null,
        multiKills: entry.multiKills,
        lastPlayedAt: entry.lastPlayedAt,
        standoutPlayer: standout?.nickname ?? null
      };
    })
    .sort(
      (left, right) =>
        sortDateDescending(left.lastPlayedAt, right.lastPlayedAt) ||
        right.matches - left.matches ||
        right.winRate - left.winRate
    )
    .slice(0, 8);

  const multiKillLeaders = players
    .map<PlayerMultiKillSummary>((player) => ({
      nickname: player.nickname,
      doubleKills: player.stats.multiKills.double,
      tripleKills: player.stats.multiKills.triple,
      quadroKills: player.stats.multiKills.quadro,
      pentaKills: player.stats.multiKills.penta,
      total: player.stats.multiKills.total,
      peak:
        player.stats.multiKills.penta > 0
          ? 5
          : player.stats.multiKills.quadro > 0
            ? 4
            : player.stats.multiKills.triple > 0
              ? 3
              : player.stats.multiKills.double > 0
                ? 2
                : 0
    }))
    .sort((left, right) => right.total - left.total || right.peak - left.peak);

  return {
    recentMatches,
    matchDayMatches,
    mapPerformance,
    multiKillLeaders
  };
}

function buildHighlights(player: PlayerSnapshot): PlayerHighlight[] {
  const { stats } = player;

  return [
    {
      label: "Form",
      value: `${round(stats.recentKd, 2)} K/D`,
      detail: `${round(stats.recentWinRate, 0)}% wins over ${stats.matchesReviewed} maps`
    },
    {
      label: "Frag",
      value: `${round(stats.recentAverageKills, 1)} kills`,
      detail: `${round(stats.recentHeadshotsPct, 0)}% HS og ${round(stats.recentKr, 2)} K/R`
    },
    {
      label: "Multi",
      value: `${stats.multiKills.total}`,
      detail: `3K ${stats.multiKills.triple} / 4K ${stats.multiKills.quadro} / 5K ${stats.multiKills.penta}`
    }
  ];
}

function mapLifetimeStats(payload: JsonRecord): PlayerLifetimeStats {
  const lifetime = asRecord(payload.lifetime ?? payload);
  const matches = pickNumber(lifetime, ["Matches", "matches"]) ?? 0;
  const wins = pickNumber(lifetime, ["Wins", "wins"]) ?? 0;

  return {
    matches: Math.round(matches),
    wins: Math.round(wins),
    winRate:
      round(
        pickNumber(lifetime, ["Win Rate %", "Win Rate", "win_rate", "winRate"]) ??
          (matches > 0 ? (wins / matches) * 100 : 0),
        1
      ) ?? 0,
    averageKd:
      round(
        pickNumber(lifetime, [
          "Average K/D Ratio",
          "Average KD Ratio",
          "K/D Ratio",
          "KD Ratio"
        ]) ?? 0,
        2
      ) ?? 0,
    averageKr:
      round(
        pickNumber(lifetime, [
          "Average K/R Ratio",
          "Average KR Ratio",
          "K/R Ratio",
          "KR Ratio"
        ]) ?? 0,
        2
      ) ?? 0,
    headshotsPct:
      round(
        pickNumber(lifetime, ["Headshots %", "Average Headshots %", "HS %", "Headshots"]) ?? 0,
        1
      ) ?? 0,
    currentWinStreak:
      Math.round(
        pickNumber(lifetime, ["Current Win Streak", "Current Streak", "Current Win streak"]) ?? 0
      ) ?? 0,
    longestWinStreak:
      Math.round(
        pickNumber(lifetime, ["Longest Win Streak", "Longest Streak", "Longest Win streak"]) ?? 0
      ) ?? 0
  };
}

async function hydratePlayer(nickname: string, apiKey: string): Promise<PlayerSnapshot> {
  const player = await fetchPlayerByNickname(nickname, apiKey);
  const playerId = asString(player.player_id ?? player.playerId);
  if (!playerId) {
    throw new Error(`FACEIT-spilleren "${nickname}" mangler player_id.`);
  }

  const gameId = resolveGameId(player);
  const games = asRecord(player.games);
  const game = asRecord(games[gameId]);
  const { from: matchDayFrom, to: matchDayTo } = getMatchDayWindow();

  const [statsResponse, historyResponse, lifetimeResponse, matchDayStatsResponse] = await Promise.all([
    faceitFetch<{ items?: unknown[] }>(
      `/players/${playerId}/games/${gameId}/stats?limit=${RECENT_MATCH_LIMIT}&offset=0`,
      apiKey
    ),
    faceitFetch<{ items?: unknown[] }>(
      `/players/${playerId}/history?game=${gameId}&limit=${HISTORY_LIMIT}&offset=0`,
      apiKey
    ),
    faceitFetch<JsonRecord>(`/players/${playerId}/stats/${gameId}`, apiKey),
    faceitFetch<{ items?: unknown[] }>(
      `/players/${playerId}/games/${gameId}/stats?limit=${MATCH_DAY_LIMIT}&offset=0&from=${matchDayFrom}&to=${matchDayTo}`,
      apiKey
    )
  ]);

  const historyEntries = (historyResponse.items ?? [])
    .filter(isRecord)
    .slice(0, HISTORY_LIMIT)
    .map(mapHistoryEntry);

  const historyById = new Map(historyEntries.map((entry) => [entry.matchId, entry]));

  const form = (statsResponse.items ?? [])
    .filter(isRecord)
    .slice(0, RECENT_MATCH_LIMIT)
    .map((item, index) => {
      const matchId = asString(item.match_id ?? item.matchId);
      const fallback = (matchId ? historyById.get(matchId) : undefined) ?? historyEntries[index];
      return mapFormItem(item, fallback, index);
    });

  const matchDayForm = (matchDayStatsResponse.items ?? [])
    .filter(isRecord)
    .slice(0, MATCH_DAY_LIMIT)
    .map((item, index) => mapFormItem(item, undefined, index));

  const matchesReviewed = form.length;
  const wins = form.filter((match) => match.result === "W").length;
  const recentWinRate = matchesReviewed > 0 ? (wins / matchesReviewed) * 100 : 0;
  const multiKills = {
    double: sum(form.map((match) => match.doubleKills)),
    triple: sum(form.map((match) => match.tripleKills)),
    quadro: sum(form.map((match) => match.quadroKills)),
    penta: sum(form.map((match) => match.pentaKills)),
    total: 0
  };
  multiKills.total = multiKills.double + multiKills.triple + multiKills.quadro + multiKills.penta;

  const recentAverageKills = average(form.map((match) => match.kills));
  const recentAverageAssists = average(form.map((match) => match.assists));
  const recentKd = average(form.map((match) => match.kd));
  const recentKr = average(form.map((match) => match.kr));
  const recentHeadshotsPct = average(form.map((match) => match.headshotsPct));
  const adrValues = form.map((match) => match.adr).filter((v): v is number => v !== null);
  const recentAdr = adrValues.length > 0 ? round(average(adrValues), 0) : null;
  const utilityValues = form.map((match) => match.utilityDmg).filter((v): v is number => v !== null);
  const recentUtilityDmg = utilityValues.length > 0 ? round(average(utilityValues), 0) : null;
  const effectiveFlashValues = form
    .map((match) => match.effectiveFlashes)
    .filter((v): v is number => v !== null);
  const recentEffectiveFlashes = effectiveFlashValues.length > 0 ? round(average(effectiveFlashValues), 1) : null;
  const entryAttemptValues = form
    .map((match) => match.entryAttempts)
    .filter((v): v is number => v !== null);
  const recentEntryAttempts = entryAttemptValues.length > 0 ? round(average(entryAttemptValues), 1) : null;
  const totalKills = sum(form.map((match) => match.kills));
  const totalAssists = sum(form.map((match) => match.assists));
  const totalDeaths = sum(form.map((match) => match.deaths));
  const lifetime = mapLifetimeStats(lifetimeResponse);
  const faceitElo = asNumber(game.faceit_elo ?? game.faceitElo);
  const impactScore = round(
    recentAverageKills * 3.1 +
      recentKd * 28 +
      recentKr * 120 +
      recentWinRate * 0.9 +
      multiKills.total * 4 +
      lifetime.currentWinStreak * 2 +
      (faceitElo ?? 0) / 150,
    1
  );

  const snapshot: PlayerSnapshot = {
    playerId,
    nickname: asString(player.nickname) ?? nickname,
    avatar: asString(player.avatar),
    country: asString(player.country),
    faceitUrl: asString(player.faceit_url ?? player.faceitUrl),
    verified: Boolean(player.verified),
    region: asString(game.region ?? player.region),
    gameId,
    skillLevel: asNumber(game.skill_level ?? game.skillLevel),
    faceitElo,
    impactScore,
    lastMatch: null,
    stats: {
      matchesReviewed,
      recentWinRate: round(recentWinRate, 1),
      recentKd: round(recentKd, 2),
      recentKr: round(recentKr, 2),
      recentAverageKills: round(recentAverageKills, 1),
      recentAverageAssists: round(recentAverageAssists, 1),
      recentHeadshotsPct: round(recentHeadshotsPct, 1),
      recentAdr,
      recentUtilityDmg,
      recentEffectiveFlashes,
      recentEntryAttempts,
      totalKills,
      totalAssists,
      totalDeaths,
      multiKills,
      lifetime,
      form: form.reverse(),
      matchDayForm: matchDayForm.reverse()
    },
    highlights: [],
    history: historyEntries
  };

  snapshot.lastMatch = snapshot.stats.form.at(-1) ?? null;
  snapshot.highlights = buildHighlights(snapshot);
  return snapshot;
}

function buildSummary(players: PlayerSnapshot[]): DashboardSummary {
  const averageElo = round(
    average(players.map((player) => player.faceitElo).filter((value): value is number => value !== null)),
    0
  );
  const topElo = Math.max(...players.map((player) => player.faceitElo ?? 0));
  const averageWinRate = round(average(players.map((player) => player.stats.recentWinRate)), 1);
  const averageKd = round(average(players.map((player) => player.stats.recentKd)), 2);
  const averageHeadshotsPct = round(average(players.map((player) => player.stats.recentHeadshotsPct)), 1);
  const totalMatchesReviewed = sum(players.map((player) => player.stats.matchesReviewed));
  const totalMultiKills = sum(players.map((player) => player.stats.multiKills.total));
  const best = players[0];

  return {
    averageElo,
    topElo,
    averageWinRate,
    averageKd,
    averageHeadshotsPct,
    totalMatchesReviewed,
    totalMultiKills,
    bestPerformer: best
      ? {
          nickname: best.nickname,
          scoreLabel: `${round(best.impactScore, 0)} heat`,
          detail: `${best.stats.recentAverageKills} avg kills / ${best.stats.recentKd} K/D`
        }
      : null
  };
}

export async function buildDashboard(): Promise<FaceitDashboardResponse> {
  const apiKey = getFaceitApiKey();
  if (!apiKey) {
    throw new Error("Mangler FACEIT API key. Sæt server_side_key i .env.local eller på hosting-platformen.");
  }

  const trackedNicknames = getTrackedNicknames();
  const settled = await Promise.allSettled(
    trackedNicknames.map((nickname) => hydratePlayer(nickname, apiKey))
  );

  const basePlayers = settled
    .filter((result): result is PromiseFulfilledResult<PlayerSnapshot> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((left, right) => right.impactScore - left.impactScore);

  const missingNicknames = settled.flatMap((result, index) =>
    result.status === "rejected" ? [trackedNicknames[index]] : []
  );

  if (basePlayers.length === 0) {
    const failed = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw failed?.reason instanceof Error
      ? failed.reason
      : new Error("FACEIT gav ingen spillerdata tilbage.");
  }

  const uniqueMatchIds = Array.from(
    new Set(
      basePlayers.flatMap((player) =>
        [...player.stats.form, ...player.stats.matchDayForm].flatMap((match) =>
          match.matchId ? [match.matchId] : []
        )
      )
    )
  );

  const matchSettled = await Promise.allSettled(
    uniqueMatchIds.map(async (matchId) => ({
      matchId,
      enrichment: await fetchMatchEnrichment(matchId, apiKey)
    }))
  );

  const matchLookup = new Map(
    matchSettled.flatMap((result) =>
      result.status === "fulfilled" ? [[result.value.matchId, result.value.enrichment] as const] : []
    )
  );

  const players = basePlayers
    .map((player) => applyMatchEnrichment(player, matchLookup))
    .map((player) => ({
      ...player,
      highlights: buildHighlights(player)
    }))
    .sort((left, right) => right.impactScore - left.impactScore);

  const operations = buildOperations(players);

  return {
    generatedAt: new Date().toISOString(),
    trackedNicknames,
    missingNicknames,
    summary: buildSummary(players),
    operations,
    players
  };
}
