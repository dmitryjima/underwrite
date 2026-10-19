import type { AuditMetadata, EntityId, ISODateTimeString, TRiskLevel } from "./common";
import type { FinancialMetrics } from "./diligence";
import type { TAdjustmentStatus, TFinancialAdjustment } from "./findings";

export interface AdjustmentEvidence {
  label: string;
  documentId: EntityId;
  location?: string;
  excerpt?: string;
}

export interface Adjustment extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;
  blockId: EntityId;
  findingIds: EntityId[];
  status: TAdjustmentStatus;
  title: string;
  rationale: string;
  confidence: number;
  changes: TFinancialAdjustment[];
  before: FinancialMetrics;
  after: FinancialMetrics;
  evidence: AdjustmentEvidence[];
  riskBefore: TRiskLevel;
  riskAfter: TRiskLevel;
  decidedBy?: EntityId;
  decidedAt?: ISODateTimeString;
  decisionComment?: string;
}
