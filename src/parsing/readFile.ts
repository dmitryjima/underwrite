import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import mammoth from "mammoth/mammoth.browser";
import type { ParsedFile, ParsedLine } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SECTION = /^\d+\.\s+[A-Z][^.]{2,60}$/;

function annotateSections(lines: ParsedLine[]): ParsedLine[] {
  let current: string | undefined;
  for (const l of lines) {
    if (SECTION.test(l.text)) current = l.text;
    else if (current) l.section = current;
  }
  return lines;
}

const colLetter = (i: number) => String.fromCharCode(65 + Math.min(i, 25));

type TextItem = { str: string; transform: number[] };

async function readPdf(file: File): Promise<ParsedFile> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: ParsedLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    // Group text items that share a baseline into one visual line (table rows become one line).
    const rows: { y: number; items: { x: number; str: string }[] }[] = [];
    for (const raw of content.items as unknown as Partial<TextItem>[]) {
      if (!raw.str?.trim() || !raw.transform) continue;
      const [x, y] = [raw.transform[4], raw.transform[5]];
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, str: raw.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      lines.push({
        text: r.items
          .map((i) => i.str.trim())
          .join(" ")
          .replace(/\s+/g, " "),
        page: p,
      });
    }
  }
  return {
    kind: "pdf",
    fileName: file.name,
    pageCount: pdf.numPages,
    lines: annotateSections(lines),
  };
}

async function readXlsx(file: File): Promise<ParsedFile> {
  const lines: ParsedLine[] = [];
  for (const sheet of await readSheetNames(file)) {
    const rows = await readXlsxFile(file, { sheet });
    rows.forEach((cells, i) => {
      const vals = cells.map((c) =>
        c === null || c === undefined
          ? ""
          : typeof c === "number"
            ? String(Math.round(c * 1e6) / 1e6)
            : c instanceof Date
              ? c.toISOString().slice(0, 10)
              : String(c),
      );
      while (vals.length && vals[vals.length - 1] === "") vals.pop();
      if (vals.length)
        lines.push({
          text: vals.join(" | "),
          sheet,
          row: i + 1,
          lastCol: colLetter(cells.length - 1),
        });
    });
  }
  return { kind: "xlsx", fileName: file.name, lines };
}

async function readDocx(file: File): Promise<ParsedFile> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const lines = value
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  return { kind: "docx", fileName: file.name, lines: annotateSections(lines) };
}

export async function readFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return readPdf(file);
  if (ext === "xlsx") return readXlsx(file);
  if (ext === "docx") return readDocx(file);
  throw new Error(`Unsupported file type ".${ext}". Upload a PDF, XLSX or DOCX file.`);
}
