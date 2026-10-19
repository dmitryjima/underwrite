import type { TDocumentType } from "../types/documents";

export const ACCEPTED_EXT = ".pdf,.xlsx,.docx";

export const DOC_TYPE_OPTIONS: { id: TDocumentType; label: string }[] = [
  { id: "financing_report", label: "Financing report" },
  { id: "management_report", label: "Management report" },
  { id: "teaser", label: "Teaser" },
  { id: "financial_statements", label: "Financial statements" },
  { id: "loan_agreement", label: "Loan agreement" },
  { id: "other", label: "Other" },
];

export function guessDocType(fileName: string): TDocumentType {
  const n = fileName.toLowerCase();
  if (n.includes("teaser")) return "teaser";
  if (/financing|credit/.test(n)) return "financing_report";
  if (/management|commentary|mgmt/.test(n)) return "management_report";
  if (n.includes("statement")) return "financial_statements";
  return "other";
}
