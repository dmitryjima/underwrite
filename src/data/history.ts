import type { FinancialMetrics } from "../types/diligence";

// Mocked historical financials. Northwind has a hand-written story (the one told by the demo files);
// every other deal gets a deterministic back-cast in lib/history.ts.
// Amounts are in whole currency units.
export interface HistoryRow {
  period: string;
  m: FinancialMetrics;
}

const M = 1_000_000;
const row = (
  period: string,
  rev: number,
  ebitda: number,
  debt: number,
  cash: number,
  leverage: number,
  npl: number,
): HistoryRow => ({
  period,
  m: {
    revenue: { amount: rev * M, currency: "USD" },
    ebitda: { amount: ebitda * M, currency: "USD" },
    totalDebt: { amount: debt * M, currency: "USD" },
    cash: { amount: cash * M, currency: "USD" },
    netDebt: { amount: Math.round((debt - cash) * M), currency: "USD" },
    leverage,
    nplRatio: npl,
  },
});

/** As shown in the financing report: debt includes the supply-chain financing programme. */
const NORTHWIND_REPORTED: HistoryRow[] = [
  row("FY2021", 96, 10.1, 48, 9.0, 4.8, 2.4),
  row("FY2022", 104, 10.6, 55, 8.2, 5.2, 3.1),
  row("FY2023", 113, 10.9, 66, 7.0, 6.1, 4.4),
  row("FY2024", 121, 11.2, 74, 6.1, 6.6, 5.7),
  row("FY2025", 125, 11.4, 78, 5.8, 6.8, 6.3),
];

/** As shown in management accounts: non-recourse programme excluded, overdue balances reconciled. */
const NORTHWIND_MANAGEMENT: HistoryRow[] = [
  row("FY2021", 96, 10.3, 29, 9.0, 2.8, 1.9),
  row("FY2022", 104, 10.8, 34, 8.2, 3.1, 2.0),
  row("FY2023", 113, 11.1, 35, 7.0, 3.2, 2.2),
  row("FY2024", 121, 11.4, 34, 6.1, 3.0, 2.3),
  row("FY2025", 125, 11.6, 33, 5.8, 2.8, 2.2),
];

export const HISTORY: Record<string, { financial: HistoryRow[]; management?: HistoryRow[] }> = {
  "deal-northwind": { financial: NORTHWIND_REPORTED, management: NORTHWIND_MANAGEMENT },
};
