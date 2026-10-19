import type { EntityId, ISODateTimeString } from "./common";

export type TActivityType =
  | "deal_created"
  | "deal_updated"
  | "stage_changed"
  | "cycle_changed"
  | "document_uploaded"
  | "document_parsed"
  | "finding_created"
  | "adjustment_accepted"
  | "adjustment_rejected"
  | "memo_generated"
  | "memo_approved";

export interface ActivityEvent {
  id: EntityId;
  dealId: EntityId;
  actorId: EntityId;
  type: TActivityType;
  timestamp: ISODateTimeString;

  summary: string;

  entityType?: "deal" | "document" | "finding" | "adjustment" | "memo";
  entityId?: EntityId;

  metadata?: Record<string, unknown>;
}
