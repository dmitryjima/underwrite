import type { Deal } from "../types/deals";
import type { DiligenceBlock, FinancialMetrics } from "../types/diligence";
import { HISTORY, type HistoryRow } from "../data/history";

export type HistoryRange = "latest" | "3y" | "5y";
export const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "3y", label: "3 years" },
  { id: "5y", label: "5 years" },
];
export const parseRange = (v: string | null): HistoryRange =>
  v === "3y" || v === "5y" ? v : "latest";

export interface HistPoint {
  period: string;
  m: FinancialMetrics;
  current?: boolean;
}
export interface HistoryBundle {
  financial: HistPoint[];
  // Only present once a management report has been uploaded for the deal.
  management?: HistPoint[];
  // True when the series was generated rather than authored (shown as "illustrative").
  synthetic: boolean;
}

const hasMetrics = (m?: FinancialMetrics) => !!m && Object.values(m).some((v) => v !== undefined);

// Back-cast for imported deals
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function backcast(dealId: string, latest: FinancialMetrics): HistoryRow[] {
  const r = rng(dealId);
  const cur = latest.revenue?.currency ?? latest.ebitda?.currency ?? "USD";
  const g = 0.04 + r() * 0.08; // revenue growth p.a.
  const marginDrift = (r() - 0.45) * 0.012; // EBITDA margin change p.a.
  const levDrift = (r() - 0.55) * 0.5; // leverage change p.a. (x)
  const nplDrift = (r() - 0.5) * 0.5; // NPL change p.a. (pp)
  const years = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025"];
  const rev0 = latest.revenue?.amount,
    e0 = latest.ebitda?.amount;
  return years.map((period, idx) => {
    const k = years.length - idx; // years before the latest point
    const jitter = () => 1 + (r() - 0.5) * 0.02;
    const rev = rev0 !== undefined ? (rev0 / Math.pow(1 + g, k)) * jitter() : undefined;
    const margin = rev0 && e0 ? e0 / rev0 - marginDrift * k : undefined;
    const ebitda = rev !== undefined && margin !== undefined ? rev * margin : undefined;
    const leverage =
      latest.leverage !== undefined
        ? Math.max(0.5, Math.round((latest.leverage - levDrift * k) * 10) / 10)
        : undefined;
    const debt = ebitda !== undefined && leverage !== undefined ? ebitda * leverage : undefined;
    const cash =
      latest.cash && rev0 && rev !== undefined
        ? latest.cash.amount * (rev / rev0) * (1 + (r() - 0.5) * 0.1)
        : undefined;
    const money = (n?: number) =>
      n === undefined ? undefined : { amount: Math.round(n), currency: cur };
    return {
      period,
      m: {
        revenue: money(rev),
        ebitda: money(ebitda),
        totalDebt: money(debt),
        cash: money(cash),
        netDebt: debt !== undefined && cash !== undefined ? money(debt - cash) : undefined,
        leverage,
        nplRatio:
          latest.nplRatio !== undefined
            ? Math.max(0.2, Math.round((latest.nplRatio - nplDrift * k) * 10) / 10)
            : undefined,
      },
    };
  });
}

const finOf = (blocks: DiligenceBlock[]) => blocks.find((b) => b.type === "financial_analysis");
const mgmtOf = (blocks: DiligenceBlock[]) => blocks.find((b) => b.type === "management_reporting");

/** The history shown on the deal page. The last point is always the live block metrics (so accepted adjustments show up). */
export function historyBundle(deal: Deal, blocks: DiligenceBlock[]): HistoryBundle {
  const fin = finOf(blocks),
    mg = mgmtOf(blocks);
  const finLatest = fin && fin.type === "financial_analysis" ? fin.content.metrics : undefined;
  const mgLatest = mg && mg.type === "management_reporting" ? mg.content.metrics : undefined;
  const mgActive =
    mg && mg.type === "management_reporting" && mg.content.reconciliationStatus !== "not_started";

  // authored on the block itself wins, then the mock dataset, then a back-cast
  const onBlock =
    fin && fin.type === "financial_analysis" ? fin.content.historicalMetrics : undefined;
  const authored = HISTORY[deal.id];
  let rows: HistoryRow[] = [];
  let synthetic = false;
  if (onBlock?.length)
    rows = onBlock.map((m, i) => ({ period: m.period ?? `Y-${onBlock.length - i}`, m }));
  else if (authored) rows = authored.financial;
  else if (hasMetrics(finLatest)) {
    rows = backcast(deal.id, finLatest!);
    synthetic = true;
  }

  const toPoints = (r: HistoryRow[], latest?: FinancialMetrics, label = "Current"): HistPoint[] => [
    ...r.map((x) => ({ period: x.period, m: x.m })),
    ...(hasMetrics(latest) ? [{ period: label, m: latest!, current: true }] : []),
  ];
  return {
    financial: rows.length ? toPoints(rows, finLatest) : [],
    management:
      mgActive && authored?.management ? toPoints(authored.management, mgLatest) : undefined,
    synthetic,
  };
}

// Latest = current point only, 3y = last three fiscal years + current, 5y = everything.
export function sliceRange(points: HistPoint[], range: HistoryRange): HistPoint[] {
  if (range === "latest") return points.slice(-1);
  return range === "3y" ? points.slice(-4) : points.slice(-6);
}

export const num = {
  money: (
    m: FinancialMetrics | undefined,
    k: "revenue" | "ebitda" | "totalDebt" | "cash" | "netDebt",
  ) => m?.[k]?.amount,
  margin: (m: FinancialMetrics) =>
    m.revenue && m.ebitda && m.revenue.amount
      ? (m.ebitda.amount / m.revenue.amount) * 100
      : undefined,
};

// Compound annual growth between the first and last point of a series (years = points - 1).
export function getCompoundAnnualGrowth(
  first?: number,
  last?: number,
  years = 1,
): number | undefined {
  if (!first || !last || first <= 0 || last <= 0 || years <= 0) return undefined;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}
