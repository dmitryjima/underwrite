export interface ParsedLine {
  text: string;
  page?: number;
  sheet?: string;
  row?: number;
  lastCol?: string;
  section?: string;
}

export interface ParsedFile {
  kind: "pdf" | "xlsx" | "docx";
  fileName: string;
  pageCount?: number;
  lines: ParsedLine[];
}
