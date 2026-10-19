import type { AuditMetadata, EntityId, ISODateTimeString } from "./common";

export type TMemoType = "preliminary" | "full" | "final";

export type TMemoStatus = "draft" | "in_review" | "ready_for_ic" | "approved" | "superseded";

export interface MemoSection {
  id: string;
  title: string;
  content: string;
  sourceDocumentIds: EntityId[];
  relatedFindingIds: EntityId[];
}

export interface ICMemo extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;

  type: TMemoType;
  status: TMemoStatus;
  version: number;

  title: string;
  sections: MemoSection[];

  generatedAt?: ISODateTimeString;
  generatedBy?: EntityId;

  sourceRevision: number;

  approvedBy?: EntityId;
  approvedAt?: ISODateTimeString;
}
