const relativeFormatter = new Intl.RelativeTimeFormat("da", {
  numeric: "auto"
});

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${formatNumber(value, digits)}%`;
}

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("da-DK", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Ukendt";
  }

  return dateFormatter.format(new Date(value));
}

export function formatAgo(value: string | null | undefined) {
  if (!value) {
    return "ukendt";
  }

  const input = new Date(value).getTime();
  const now = Date.now();
  const deltaSeconds = Math.round((input - now) / 1000);
  const abs = Math.abs(deltaSeconds);

  if (abs < 60) {
    return relativeFormatter.format(deltaSeconds, "seconds");
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) {
    return relativeFormatter.format(deltaMinutes, "minutes");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return relativeFormatter.format(deltaHours, "hours");
  }

  const deltaDays = Math.round(deltaHours / 24);
  return relativeFormatter.format(deltaDays, "days");
}
