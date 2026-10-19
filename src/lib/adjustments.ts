import type { TRiskLevel } from "../types/common";
import type { FinancialMetrics } from "../types/diligence";
import type { TFinancialAdjustment } from "../types/findings";
import { FUND_POLICY } from "./deal-meta";

type Operation = "replace" | "add" | "subtract";

const op = (cur: number | undefined, operation: Operation, v: number) =>
  operation === "replace" ? v : operation === "add" ? (cur ?? 0) + v : (cur ?? 0) - v;

const MONEY_KEYS = {
  total_debt: "totalDebt",
  net_debt: "netDebt",
  ebitda: "ebitda",
  revenue: "revenue",
} as const;

// Applied changes in order and returns new metrics object
export function applyChanges(
  metrics: FinancialMetrics,
  changes: TFinancialAdjustment[],
): FinancialMetrics {
  const next: FinancialMetrics = { ...metrics };
  for (const c of changes) {
    switch (c.targetMetric) {
      case "leverage":
        next.leverage = Math.round(op(next.leverage, c.operation, c.value) * 10) / 10;
        break;
      case "npl_ratio":
        next.nplRatio = Math.round(op(next.nplRatio, c.operation, c.value) * 10) / 10;
        break;
      default: {
        const key = MONEY_KEYS[c.targetMetric];
        const cur = next[key];
        next[key] = {
          currency: cur?.currency ?? c.value.currency,
          amount: Math.round(op(cur?.amount, c.operation, c.value.amount)),
        };
      }
    }
  }
  return next;
}

/** Simple, explainable risk rule against the fund policy limits. */
export function deriveRisk(m: FinancialMetrics): TRiskLevel {
  if (m.nplRatio === undefined && m.leverage === undefined) return "unknown";
  const nplBreach = (m.nplRatio ?? 0) > FUND_POLICY.maxNplRatio;
  const levBreach = (m.leverage ?? 0) > FUND_POLICY.maxLeverage;
  if (nplBreach && levBreach) return "high";
  if (nplBreach || levBreach) return "elevated";
  return (m.leverage ?? 0) <= 3 && (m.nplRatio ?? 0) <= 2 ? "low" : "moderate";
}
