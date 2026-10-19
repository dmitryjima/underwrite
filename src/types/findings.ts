import type { AuditMetadata, EntityId, ISODateTimeString, TRiskLevel, Money } from "./common";

export type TFindingSource = "ai_analysis" | "manual_review" | "rule";

export type TFindingStatus = "open" | "under_review" | "accepted" | "rejected" | "resolved";

export interface Finding extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;

  title: string;
  description: string;
  source: TFindingSource;
  status: TFindingStatus;
  severity: TRiskLevel;

  sourceDocumentIds: EntityId[];
  relatedBlockIds: EntityId[];

  suggestedAdjustmentId?: EntityId;
  reviewerId?: EntityId;
  reviewedAt?: ISODateTimeString;
  reviewerComment?: string;
}

export type TAdjustmentStatus = "proposed" | "accepted" | "rejected" | "superseded";

export type TFinancialAdjustment =
  | {
      targetMetric: "total_debt" | "net_debt" | "ebitda" | "revenue";
      operation: "replace" | "add" | "subtract";
      value: Money;
    }
  | {
      targetMetric: "leverage";
      operation: "replace" | "add" | "subtract";
      value: number;
    }
  | {
      targetMetric: "npl_ratio";
      operation: "replace" | "add" | "subtract";
      value: number;
    };
