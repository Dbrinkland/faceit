import { normalizeCs2MapName } from "@/lib/cs2";
import type {
  DashboardSummary,
  FaceitDashboardResponse,
  PlayerFormMatch,
  PlayerMultiKillSummary,
  PlayerSnapshot,
  SquadMapPerformance,
  SquadRecentMatch
} from "@/lib/types";

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

export function sortDateDescending(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

function buildSummary(players: PlayerSnapshot[]): DashboardSummary {
  const eloValues = players
    .map((player) => player.faceitElo)
    .filter((value): value is number => value !== null);
  const averageElo = round(average(eloValues), 0);
  const topElo = Math.max(...players.map((player) => player.faceitElo ?? 0), 0);
  const averageWinRate = round(average(players.map((player) => player.stats.recentWinRate)), 1);
  const averageKd = round(average(players.map((player) => player.stats.recentKd)), 2);
  const averageHeadshotsPct = round(average(players.map((player) => player.stats.recentHeadshotsPct)), 1);
  const totalMatchesReviewed = sum(players.map((player) => player.stats.matchesReviewed));
  const totalMultiKills = sum(players.map((player) => player.stats.multiKills.total));
  const best = players
    .filter((player) => player.stats.matchesReviewed > 0)
    .sort((left, right) => right.impactScore - left.impactScore)[0];

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

function aggregateMatches(players: PlayerSnapshot[], selector: (player: PlayerSnapshot) => PlayerFormMatch[]) {
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
          entryKills: number | null;
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
        entryKills: match.entryKills,
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
      const entryKillValues = entry.players
        .map((player) => player.entryKills)
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
            right.kills +
              right.kd * 10 +
              (right.adr ?? 0) * 0.25 +
              (right.entryKills ?? 0) * 2 +
              right.multiKillPeak * 2 -
            (left.kills +
              left.kd * 10 +
              (left.adr ?? 0) * 0.25 +
              (left.entryKills ?? 0) * 2 +
              left.multiKillPeak * 2)
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
        averageEntryKills:
          entryKillValues.length > 0 ? round(average(entryKillValues), 1) : null,
        multiKills,
        peakMultiKill,
        standoutPlayer: standout?.nickname ?? null
      };
    });
}

function buildMapPerformance(players: PlayerSnapshot[]): SquadMapPerformance[] {
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

  return Array.from(maps.values())
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
}

function buildMultiKillLeaders(players: PlayerSnapshot[]) {
  return players
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
}

function buildDerivedPlayers(players: PlayerSnapshot[], lockToMatchDay: boolean) {
  return players
    .map<PlayerSnapshot>((player) => {
      const selectedForm = lockToMatchDay ? player.stats.matchDayForm : player.stats.form;
      const matchesReviewed = selectedForm.length;
      const wins = selectedForm.filter((match) => match.result === "W").length;
      const recentWinRate = matchesReviewed > 0 ? (wins / matchesReviewed) * 100 : 0;
      const multiKills = {
        double: sum(selectedForm.map((match) => match.doubleKills)),
        triple: sum(selectedForm.map((match) => match.tripleKills)),
        quadro: sum(selectedForm.map((match) => match.quadroKills)),
        penta: sum(selectedForm.map((match) => match.pentaKills)),
        total: 0
      };
      multiKills.total = multiKills.double + multiKills.triple + multiKills.quadro + multiKills.penta;

      const recentAverageKills = average(selectedForm.map((match) => match.kills));
      const recentAverageAssists = average(selectedForm.map((match) => match.assists));
      const recentKd = average(selectedForm.map((match) => match.kd));
      const recentKr = average(selectedForm.map((match) => match.kr));
      const recentHeadshotsPct = average(selectedForm.map((match) => match.headshotsPct));
      const adrValues = selectedForm.map((match) => match.adr).filter((value): value is number => value !== null);
      const recentAdr = adrValues.length > 0 ? round(average(adrValues), 0) : null;
      const utilityValues = selectedForm
        .map((match) => match.utilityDmg)
        .filter((value): value is number => value !== null);
      const recentUtilityDmg = utilityValues.length > 0 ? round(average(utilityValues), 0) : null;
      const effectiveFlashValues = selectedForm
        .map((match) => match.effectiveFlashes)
        .filter((value): value is number => value !== null);
      const recentEffectiveFlashes = effectiveFlashValues.length > 0 ? round(average(effectiveFlashValues), 1) : null;
      const entryAttemptValues = selectedForm
        .map((match) => match.entryAttempts)
        .filter((value): value is number => value !== null);
      const recentEntryAttempts = entryAttemptValues.length > 0 ? round(average(entryAttemptValues), 1) : null;
      const entryKillValues = selectedForm
        .map((match) => match.entryKills)
        .filter((value): value is number => value !== null);
      const recentEntryKills = entryKillValues.length > 0 ? round(average(entryKillValues), 1) : null;
      const totalKills = sum(selectedForm.map((match) => match.kills));
      const totalAssists = sum(selectedForm.map((match) => match.assists));
      const totalDeaths = sum(selectedForm.map((match) => match.deaths));
      const impactScore =
        matchesReviewed > 0
          ? round(
              recentAverageKills * 3.1 +
                recentKd * 28 +
                recentKr * 120 +
                recentWinRate * 0.9 +
                multiKills.total * 4 +
                player.stats.lifetime.currentWinStreak * 2 +
                (player.faceitElo ?? 0) / 150,
              1
            )
          : 0;

      return {
        ...player,
        impactScore,
        lastMatch: selectedForm.at(-1) ?? null,
        stats: {
          ...player.stats,
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
          recentEntryKills,
          totalKills,
          totalAssists,
          totalDeaths,
          multiKills,
          form: selectedForm
        }
      };
    })
    .sort((left, right) => right.impactScore - left.impactScore);
}

export function buildDashboardView(data: FaceitDashboardResponse | null, lockToMatchDay: boolean) {
  if (!data) {
    return null;
  }

  const players = buildDerivedPlayers(data.players, lockToMatchDay);
  const recentMatches = aggregateMatches(players, (player) => player.stats.form).slice(0, 6);
  const matchDayMatches = aggregateMatches(players, (player) => player.stats.matchDayForm);

  return {
    ...data,
    summary: buildSummary(players),
    operations: {
      recentMatches: lockToMatchDay ? matchDayMatches.slice(0, 6) : recentMatches,
      matchDayMatches,
      mapPerformance: buildMapPerformance(players),
      multiKillLeaders: buildMultiKillLeaders(players)
    },
    players
  };
}
