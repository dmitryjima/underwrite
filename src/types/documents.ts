import type { AuditMetadata, EntityId, ISODateTimeString } from "./common";

export type TDocumentType =
  | "teaser"
  | "financing_report"
  | "management_report"
  | "financial_statements"
  | "financial_model"
  | "debt_schedule"
  | "loan_agreement"
  | "presentation"
  | "ic_memo"
  | "other";

export type TDocumentProcessingStatus = "uploaded" | "processing" | "parsed" | "failed";

export interface ExtractedField<T = unknown> {
  value: T;
  sourceDocumentId: EntityId;
  sourceLocation?: {
    page?: number;
    sheet?: string;
    cellRange?: string;
    section?: string;
  };
  confidence?: number;
}

export interface DealDocument extends AuditMetadata {
  id: EntityId;
  dealId: EntityId;
  name: string;
  type: TDocumentType;
  mimeType: string;
  sizeBytes: number;

  uploadedBy: EntityId;
  uploadedAt: ISODateTimeString;

  processingStatus: TDocumentProcessingStatus;
  processingError?: string;

  extractedFields?: Record<string, ExtractedField>;
  description?: string;
}
