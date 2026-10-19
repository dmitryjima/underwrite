import type { TRiskLevel, TReadiness } from "../types/common";
import type { TDealStage, TDealType } from "../types/deals";

export const STAGES: { id: TDealStage; label: string; color: string }[] = [
  { id: "teaser_evaluation", label: "Teaser evaluation", color: "#64748b" },
  { id: "due_diligence", label: "Due diligence", color: "#2563eb" },
  { id: "ic_preparation", label: "IC preparation", color: "#7c3aed" },
  { id: "ic_review", label: "IC review", color: "#d97706" },
  { id: "approved", label: "Approved", color: "#16a34a" },
  { id: "declined", label: "Declined", color: "#dc2626" },
  { id: "closed", label: "Closed", color: "#0f766e" },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<
  TDealStage,
  (typeof STAGES)[number]
>;

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const RISK_META: Record<
  TRiskLevel,
  { label: string; order: number; color: "success" | "info" | "warning" | "error" | "default" }
> = {
  low: { label: "Low", order: 1, color: "success" },
  moderate: { label: "Moderate", order: 2, color: "info" },
  elevated: { label: "Elevated", order: 3, color: "warning" },
  high: { label: "High", order: 4, color: "error" },
  critical: { label: "Critical", order: 5, color: "error" },
  unknown: { label: "Unknown", order: 0, color: "default" },
};

export const READINESS_META: Record<
  TReadiness,
  { label: string; color: "default" | "info" | "warning" | "success" }
> = {
  not_started: { label: "Not started", color: "default" },
  in_progress: { label: "In progress", color: "info" },
  needs_review: { label: "Needs review", color: "warning" },
  complete: { label: "Complete", color: "success" },
};

export const DEAL_TYPE_LABELS: Record<TDealType, string> = {
  senior_secured: "Senior secured",
  unitranche: "Unitranche",
  second_lien: "Second lien",
  mezzanine: "Mezzanine",
  asset_based: "Asset based",
  other: "Other",
};

// Crucial metrics for a credit fund;
// In a real app those would likely come from a specific version of
// a configurable investement thesis entity
export const FUND_POLICY = { maxNplRatio: 3, maxLeverage: 5 } as const;

// The demo's today is fixed to ensure consitency in all the static data
export const DEMO_TODAY = "2026-10-18";

export const AI_ACTOR_ID = "system-ai";
export const AI_ACTOR_NAME = "Underwrite AI";

export const STATUS_OPTIONS: Record<TDealStage, string[]> = {
  teaser_evaluation: ["new", "screening", "screening_complete"],
  due_diligence: ["not_started", "in_progress", "blocked", "complete"],
  ic_preparation: ["drafting", "internal_review", "ready_for_ic"],
  ic_review: ["scheduled", "under_review", "decision_pending"],
  approved: ["approved_with_conditions", "approved"],
  declined: ["declined"],
  closed: ["funded", "withdrawn", "expired"],
};

export type DealFormField =
  | "name"
  | "borrowerName"
  | "ownerId"
  | "dealType"
  | "requestedAmount"
  | "cycleId"
  | "industry"
  | "location"
  | "proposedAmount"
  | "targetCloseDate"
  | "nextIcDate";

const BASE: DealFormField[] = ["name", "borrowerName", "ownerId"];
const DD: DealFormField[] = [
  ...BASE,
  "dealType",
  "requestedAmount",
  "cycleId",
  "industry",
  "location",
];
const IC: DealFormField[] = [...DD, "proposedAmount", "targetCloseDate", "nextIcDate"];

/** Which fields become mandatory as a deal moves down the pipeline. */
export const REQUIRED_BY_STAGE: Record<TDealStage, DealFormField[]> = {
  teaser_evaluation: BASE,
  due_diligence: DD,
  ic_preparation: IC,
  ic_review: IC,
  approved: [...DD, "proposedAmount", "targetCloseDate"],
  declined: DD,
  closed: [...DD, "proposedAmount", "targetCloseDate"],
};
