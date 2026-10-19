export type EntityId = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type CurrencyCode = string;

export type TEntityStatus = "active" | "archived";

export type TReadiness = "not_started" | "in_progress" | "needs_review" | "complete";

export type TRiskLevel = "low" | "moderate" | "elevated" | "high" | "critical" | "unknown";

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface DateRange {
  startDate: ISODateString;
  endDate: ISODateString;
}

export interface UserReference {
  id: EntityId;
  name: string;
}

export interface AuditMetadata {
  createdAt: ISODateTimeString;
  createdBy: EntityId;
  updatedAt: ISODateTimeString;
  updatedBy: EntityId;
}
