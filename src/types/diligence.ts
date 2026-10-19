import type { AuditMetadata, EntityId, Money, TReadiness } from "./common";

export const DILIGENCE_BLOCK_TYPES = [
  "financial_analysis",
  "management_reporting",
  "credit_analysis",
  "business_overview",
  "market_analysis",
  "legal_due_diligence",
  "investment_thesis",
] as const;

export type TDiligenceBlockType = (typeof DILIGENCE_BLOCK_TYPES)[number];

export interface FinancialMetrics {
  period?: string;
  revenue?: Money;
  ebitda?: Money;
  totalDebt?: Money;
  cash?: Money;
  netDebt?: Money;
  leverage?: number;
  nplRatio?: number;
}

export interface DiligenceBlockBase extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;
  title: string;
  readiness: TReadiness;
  ownerId?: EntityId;
  documentIds: EntityId[];
  findingIds: EntityId[];
  notes?: string;
}

export type DiligenceBlock =
  | (DiligenceBlockBase & {
      type: "financial_analysis";
      content: {
        reportingPeriod?: string;
        metrics: FinancialMetrics;
        historicalMetrics?: FinancialMetrics[];
        commentary?: string;
      };
    })
  | (DiligenceBlockBase & {
      type: "management_reporting";
      content: {
        reportingPeriod?: string;
        metrics: FinancialMetrics;
        commentary?: string;
        reconciliationStatus: "not_started" | "in_progress" | "reconciled" | "discrepancy_found";
      };
    })
  | (DiligenceBlockBase & {
      type: Exclude<TDiligenceBlockType, "financial_analysis" | "management_reporting">;
      content: Record<string, unknown>;
    });
