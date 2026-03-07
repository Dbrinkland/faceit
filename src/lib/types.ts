export type PlayerFormMatch = {
  matchIndex: number;
  matchId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  map: string | null;
  competition: string | null;
  score: string | null;
  result: "W" | "L" | "?";
  kills: number;
  assists: number;
  deaths: number;
  kd: number;
  kr: number;
  headshotsPct: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  multiKillPeak: number;
  adr: number | null;
  utilityDmg: number | null;
  effectiveFlashes: number | null;
  entryAttempts: number | null;
  entryKills: number | null;
};

export type PlayerHistoryEntry = {
  matchId: string;
  finishedAt: string | null;
  competition: string | null;
  map: string | null;
  result: string | null;
  score: string | null;
};

export type PlayerHighlight = {
  label: string;
  value: string;
  detail: string;
};

export type PlayerLifetimeStats = {
  matches: number;
  wins: number;
  winRate: number;
  averageKd: number;
  averageKr: number;
  headshotsPct: number;
  currentWinStreak: number;
  longestWinStreak: number;
};

export type PlayerMultiKillSummary = {
  nickname: string;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  total: number;
  peak: number;
};

export type PlayerSnapshot = {
  playerId: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  faceitUrl: string | null;
  verified: boolean;
  region: string | null;
  gameId: string;
  skillLevel: number | null;
  faceitElo: number | null;
  impactScore: number;
  lastMatch: PlayerFormMatch | null;
  stats: {
    matchesReviewed: number;
    recentWinRate: number;
    recentKd: number;
    recentKr: number;
    recentAverageKills: number;
    recentAverageAssists: number;
    recentHeadshotsPct: number;
    recentAdr: number | null;
    recentUtilityDmg: number | null;
    recentEffectiveFlashes: number | null;
    recentEntryAttempts: number | null;
    recentEntryKills: number | null;
    totalKills: number;
    totalAssists: number;
    totalDeaths: number;
    multiKills: {
      double: number;
      triple: number;
      quadro: number;
      penta: number;
      total: number;
    };
    lifetime: PlayerLifetimeStats;
    form: PlayerFormMatch[];
    matchDayForm: PlayerFormMatch[];
  };
  highlights: PlayerHighlight[];
  history: PlayerHistoryEntry[];
};

export type SquadRecentMatch = {
  matchId: string;
  finishedAt: string | null;
  competition: string | null;
  map: string | null;
  score: string | null;
  result: "W" | "L" | "?";
  trackedPlayers: number;
  averageKills: number;
  averageKd: number;
  averageKr: number;
  averageHeadshotsPct: number;
  averageAdr: number | null;
  averageUtilityDmg: number | null;
  averageEffectiveFlashes: number | null;
  averageEntryAttempts: number | null;
  averageEntryKills: number | null;
  multiKills: number;
  peakMultiKill: number;
  standoutPlayer: string | null;
};

export type SquadMapPerformance = {
  map: string;
  matches: number;
  winRate: number;
  averageKills: number;
  averageKd: number;
  averageHeadshotsPct: number;
  averageAdr: number | null;
  multiKills: number;
  lastPlayedAt: string | null;
  standoutPlayer: string | null;
};

export type DashboardSummary = {
  averageElo: number;
  topElo: number;
  averageWinRate: number;
  averageKd: number;
  averageHeadshotsPct: number;
  totalMatchesReviewed: number;
  totalMultiKills: number;
  bestPerformer:
    | {
        nickname: string;
        scoreLabel: string;
        detail: string;
      }
    | null;
};

export type FaceitDashboardResponse = {
  generatedAt: string;
  trackedNicknames: string[];
  missingNicknames: string[];
  summary: DashboardSummary;
  operations: {
    recentMatches: SquadRecentMatch[];
    matchDayMatches: SquadRecentMatch[];
    mapPerformance: SquadMapPerformance[];
    multiKillLeaders: PlayerMultiKillSummary[];
  };
  players: PlayerSnapshot[];
};

export type FaceitDashboardError = {
  message: string;
};
