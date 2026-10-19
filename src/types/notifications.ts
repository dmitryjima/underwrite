import type { EntityId, ISODateTimeString } from "./common";

export interface AppNotification {
  id: EntityId;
  dealId: EntityId;
  kind: "ai_suggestion" | "document_parsed" | "info";
  severity: "info" | "success" | "warning";
  title: string;
  body: string;
  createdAt: ISODateTimeString;
  recipientIds: EntityId[];
  readBy: EntityId[];
  adjustmentId?: EntityId;
}
