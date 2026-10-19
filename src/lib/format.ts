import type { Money } from "../types/common";

export function formatMoney(m?: Money, compact = true) {
  if (!m) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: m.currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(m.amount);
}

export function formatDate(d?: string) {
  if (!d) return "—";
  // UTC so date-only strings don't shift a day in negative-offset timezones.
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
