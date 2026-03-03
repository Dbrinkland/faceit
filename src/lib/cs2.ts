export type Cs2MapInfo = {
  key: string;
  displayName: string;
  code: string;
  sites: [string, string];
  accent: string;
  accentSoft: string;
  surface: string;
  callout: string;
};

const MAPS: Cs2MapInfo[] = [
  {
    key: "dust2",
    displayName: "Dust II",
    code: "DE_DUST2",
    sites: ["A Long", "B Tunnels"],
    accent: "#f7b26f",
    accentSoft: "rgba(247, 178, 111, 0.18)",
    surface: "linear-gradient(135deg, rgba(141, 88, 34, 0.54), rgba(31, 16, 10, 0.9))",
    callout: "Long control, cat split, late B lurk."
  },
  {
    key: "mirage",
    displayName: "Mirage",
    code: "DE_MIRAGE",
    sites: ["A Ramp", "B Apps"],
    accent: "#f58b63",
    accentSoft: "rgba(245, 139, 99, 0.18)",
    surface: "linear-gradient(135deg, rgba(142, 56, 37, 0.52), rgba(24, 13, 10, 0.9))",
    callout: "Mid control, connector crunch, palace pressure."
  },
  {
    key: "inferno",
    displayName: "Inferno",
    code: "DE_INFERNO",
    sites: ["Banana", "Apps"],
    accent: "#ff6e55",
    accentSoft: "rgba(255, 110, 85, 0.18)",
    surface: "linear-gradient(135deg, rgba(156, 54, 34, 0.5), rgba(25, 11, 10, 0.92))",
    callout: "Banana control, late utility, site exec discipline."
  },
  {
    key: "nuke",
    displayName: "Nuke",
    code: "DE_NUKE",
    sites: ["A Hut", "Lower"],
    accent: "#7ea8ff",
    accentSoft: "rgba(126, 168, 255, 0.16)",
    surface: "linear-gradient(135deg, rgba(45, 64, 102, 0.54), rgba(10, 14, 22, 0.92))",
    callout: "Yard pressure, vent drops, upper crunch."
  },
  {
    key: "ancient",
    displayName: "Ancient",
    code: "DE_ANCIENT",
    sites: ["A Main", "B Lane"],
    accent: "#7ecf97",
    accentSoft: "rgba(126, 207, 151, 0.16)",
    surface: "linear-gradient(135deg, rgba(40, 82, 54, 0.48), rgba(10, 18, 12, 0.92))",
    callout: "Mid cave splits and heavy retake utility."
  },
  {
    key: "anubis",
    displayName: "Anubis",
    code: "DE_ANUBIS",
    sites: ["Canal", "Temple"],
    accent: "#6ed9d1",
    accentSoft: "rgba(110, 217, 209, 0.16)",
    surface: "linear-gradient(135deg, rgba(34, 86, 88, 0.5), rgba(8, 18, 20, 0.92))",
    callout: "Mid water control and site isolation."
  },
  {
    key: "overpass",
    displayName: "Overpass",
    code: "DE_OVERPASS",
    sites: ["A Toilets", "B Short"],
    accent: "#9bd38e",
    accentSoft: "rgba(155, 211, 142, 0.16)",
    surface: "linear-gradient(135deg, rgba(54, 92, 42, 0.5), rgba(10, 18, 11, 0.92))",
    callout: "Fountain control, fast connectors, late flanks."
  },
  {
    key: "train",
    displayName: "Train",
    code: "DE_TRAIN",
    sites: ["Ivy", "Upper B"],
    accent: "#d79272",
    accentSoft: "rgba(215, 146, 114, 0.16)",
    surface: "linear-gradient(135deg, rgba(109, 60, 42, 0.48), rgba(18, 11, 10, 0.92))",
    callout: "Ivy crunches and lane pressure across bomb trains."
  },
  {
    key: "vertigo",
    displayName: "Vertigo",
    code: "DE_VERTIGO",
    sites: ["A Ramp", "B Stairs"],
    accent: "#f6d16d",
    accentSoft: "rgba(246, 209, 109, 0.15)",
    surface: "linear-gradient(135deg, rgba(120, 96, 35, 0.46), rgba(19, 16, 9, 0.92))",
    callout: "Ramp fights, quick lurks and retake chaos."
  }
];

const FALLBACK_MAP: Cs2MapInfo = {
  key: "faceit",
  displayName: "FACEIT Server",
  code: "CS2",
  sites: ["A Site", "B Site"],
  accent: "#ff7657",
  accentSoft: "rgba(255, 118, 87, 0.16)",
  surface: "linear-gradient(135deg, rgba(123, 43, 30, 0.48), rgba(18, 10, 10, 0.92))",
  callout: "Live FACEIT pull with map intel fallback."
};

const aliasMap = new Map<string, Cs2MapInfo>();

for (const map of MAPS) {
  const aliases = [
    map.key,
    map.displayName,
    map.displayName.replace(/\s+/g, ""),
    map.displayName.replace(/\s+/g, "_"),
    map.code,
    map.code.toLowerCase()
  ];

  for (const alias of aliases) {
    aliasMap.set(alias.toLowerCase(), map);
  }
}

export const FEATURED_CS2_MAPS = MAPS.slice(0, 5);

export function getCs2MapInfo(mapName: string | null | undefined): Cs2MapInfo {
  if (!mapName) {
    return FALLBACK_MAP;
  }

  const normalized = mapName.toLowerCase().trim();
  if (!normalized) {
    return FALLBACK_MAP;
  }

  if (aliasMap.has(normalized)) {
    return aliasMap.get(normalized) ?? FALLBACK_MAP;
  }

  for (const [alias, map] of aliasMap.entries()) {
    if (normalized.includes(alias)) {
      return map;
    }
  }

  return {
    ...FALLBACK_MAP,
    displayName: mapName,
    code: mapName.toUpperCase().replace(/\s+/g, "_")
  };
}

export function normalizeCs2MapName(mapName: string | null | undefined) {
  return getCs2MapInfo(mapName).displayName;
}
