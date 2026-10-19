import type { Money } from "../types/common";
import type { ExtractedField } from "../types/documents";
import { humanize } from "../lib/deal-meta";
import { formatDate, formatMoney } from "../lib/format";

export interface ExtractedSummaryItem {
  key: string;
  label: string;
  value: string;
  location?: string;
  confidence?: number;
}

const LABELS: Record<string, string> = {
  name: "Project name",
  borrowerName: "Borrower",
  industry: "Industry",
  location: "Location",
  websiteUrl: "Website",
  requestedAmount: "Requested amount",
  dealType: "Deal type",
  targetCloseDate: "Target close",
  description: "Description",
  revenue: "Revenue",
  ebitda: "EBITDA",
  totalDebt: "Total debt",
  cash: "Cash",
  netDebt: "Net debt",
  leverage: "Leverage",
  nplRatio: "NPL ratio",
  nonPerformingExposure: "Non-performing exposure",
  reportingPeriod: "Reporting period",
  reclassifiedAmount: "Intercompany cash tranche",
  reclassifiedCounterparty: "Counterparty",
  adjustedDebt: "Adjusted financial debt",
  adjustedNetDebt: "Adjusted net debt",
  adjustedLeverage: "Adjusted leverage",
  adjustedNplRatio: "Adjusted NPL ratio",
  reportedNonPerforming: "Reported non-performing exposure",
  timingDifference: "Clearing timing difference",
  adjustedNonPerforming: "Adjusted non-performing exposure",
};

export function locationLabel(loc?: ExtractedField["sourceLocation"]): string | undefined {
  if (!loc) return undefined;
  const parts = [loc.sheet, loc.cellRange, loc.page ? `p.${loc.page}` : undefined, loc.section];
  return parts.filter(Boolean).join(" · ") || undefined;
}

function formatValue(key: string, v: unknown): string {
  if (v && typeof v === "object" && "amount" in v) return formatMoney(v as Money);
  if (typeof v === "number")
    return /npl/i.test(key) ? `${v}%` : /leverage/i.test(key) ? `${v}x` : String(v);
  if (key === "dealType") return humanize(String(v));
  if (key === "targetCloseDate") return formatDate(String(v));
  const s = String(v);
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

export function describeFields(fields: Record<string, ExtractedField>): ExtractedSummaryItem[] {
  return Object.entries(fields).map(([key, f]) => ({
    key,
    label: LABELS[key] ?? humanize(key),
    value: formatValue(key, f.value),
    location: locationLabel(f.sourceLocation),
    confidence: f.confidence,
  }));
}
