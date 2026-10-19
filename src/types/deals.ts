import type { AuditMetadata, EntityId, ISODateString, Money, TRiskLevel } from "./common";

export type TDealStage =
  | "teaser_evaluation"
  | "due_diligence"
  | "ic_preparation"
  | "ic_review"
  | "approved"
  | "declined"
  | "closed";

export type TDealWorkflow =
  | {
      stage: "teaser_evaluation";
      status: "new" | "screening" | "screening_complete";
    }
  | {
      stage: "due_diligence";
      status: "not_started" | "in_progress" | "blocked" | "complete";
    }
  | {
      stage: "ic_preparation";
      status: "drafting" | "internal_review" | "ready_for_ic";
    }
  | {
      stage: "ic_review";
      status: "scheduled" | "under_review" | "decision_pending";
    }
  | {
      stage: "approved";
      status: "approved_with_conditions" | "approved";
    }
  | {
      stage: "declined";
      status: "declined";
    }
  | {
      stage: "closed";
      status: "funded" | "withdrawn" | "expired";
    };

export type TDealType =
  "senior_secured" | "unitranche" | "second_lien" | "mezzanine" | "asset_based" | "other";

export interface Deal extends AuditMetadata {
  id: EntityId;
  name: string;
  borrowerName: string;
  description?: string;

  workflow: TDealWorkflow;
  cycleId?: EntityId;
  ownerId: EntityId;
  teamMemberIds: EntityId[];

  dealType?: TDealType;
  requestedAmount?: Money;
  proposedAmount?: Money;

  industry?: string;
  location?: string;
  websiteUrl?: string;

  targetCloseDate?: ISODateString;
  nextIcDate?: ISODateString;

  riskLevel: TRiskLevel;
  // 0%-100%
  diligenceReadiness: number;
  tags: string[];
}
