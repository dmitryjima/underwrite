import type { AuditMetadata, EntityId, ISODateString, Money } from "./common";

export type TSeniority =
  "super_senior" | "senior_secured" | "unitranche" | "second_lien" | "subordinated" | "unsecured";

export type TSecurityStatus =
  "proposed" | "under_review" | "approved" | "funded" | "repaid" | "cancelled";

export interface Security extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;

  name: string;
  type: "term_loan" | "revolver" | "delayed_draw" | "bond" | "other";
  seniority: TSeniority;
  status: TSecurityStatus;

  commitmentAmount: Money;
  fundedAmount?: Money;

  interestRate?: {
    benchmark?: string;
    spreadBps?: number;
    floorBps?: number;
    fixedRateBps?: number;
  };

  maturityDate?: ISODateString;
  amortizationDescription?: string;
  collateralDescription?: string;
  covenantSummary?: string;
}
