import type { Money } from "../types/common";
import type { TDealType } from "../types/deals";
import type { FinancialMetrics } from "../types/diligence";
import type { ExtractedField } from "../types/documents";
import type { ParsedFile, ParsedLine } from "./types";

/**
 * Rule-based extraction over parsed lines. Works the same for PDF, XLSX and DOCX because
 * every file is first flattened into `ParsedLine[]` (see readFile.ts).
 *
 *  - `label` rules: the line starts with a label, the first number after it is the value
 *    (tables: "Total financial debt (USD m) 82.0 ...").
 *  - `capture` rules: a regex whose first group is the value (prose sentences).
 */
type Rule = { label: RegExp } | { capture: RegExp };
type Loc = ExtractedField["sourceLocation"];
interface Hit<T = number | string> {
  value: T;
  line: ParsedLine;
  confidence: number;
}

const NUM = /-?\d[\d,]*(?:\.\d+)?/;
const toNum = (s: string) => Number(s.replace(/,/g, ""));
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function locOf(line: ParsedLine): Loc {
  const loc: NonNullable<Loc> = {};
  if (line.page) loc.page = line.page;
  if (line.sheet) loc.sheet = line.sheet;
  if (line.row) loc.cellRange = `A${line.row}:${line.lastCol ?? "A"}${line.row}`;
  if (line.section) loc.section = line.section;
  return loc;
}

function findNumber(file: ParsedFile, rules: Rule[]): Hit<number> | undefined {
  for (const rule of rules) {
    for (const line of file.lines) {
      if ("label" in rule) {
        const m = rule.label.exec(line.text);
        if (!m) continue;
        const n = NUM.exec(line.text.slice(m.index + m[0].length));
        if (!n) continue;
        return {
          value: Math.abs(toNum(n[0])),
          line,
          confidence: file.kind === "xlsx" ? 0.98 : 0.94,
        };
      }
      const m = rule.capture.exec(line.text);
      if (m?.[1]) return { value: toNum(m[1]), line, confidence: 0.88 };
    }
  }
}

function findText(file: ParsedFile, rules: RegExp[], confidence = 0.92): Hit<string> | undefined {
  for (const rule of rules) {
    for (const line of file.lines) {
      const m = rule.exec(line.text);
      if (m?.[1]) return { value: m[1].trim(), line, confidence };
    }
  }
}

const currencyOf = (file: ParsedFile) =>
  file.lines.map((l) => /\b(USD|EUR|GBP|CHF)\b/.exec(l.text)?.[1]).find(Boolean) ?? "USD";

const money = (millions: number, currency: string): Money => ({
  amount: Math.round(millions * 1_000_000),
  currency,
});

const PERIOD_RULE = /^Reporting period\s*[:|]\s*(.+?)(?:\s*\(|\s*\||$)/i;

export interface FinancingReportExtraction {
  period?: string;
  metrics: FinancialMetrics;
  nonPerformingExposure?: Money;
  fields: Record<string, ExtractedField>;
}

export function extractFinancingReport(file: ParsedFile): FinancingReportExtraction {
  const cur = currencyOf(file);
  const fields: Record<string, ExtractedField> = {};
  const record = (key: string, hit: Hit | undefined, value: unknown) => {
    if (hit)
      fields[key] = {
        value,
        sourceDocumentId: "",
        sourceLocation: locOf(hit.line),
        confidence: hit.confidence,
      };
  };
  const moneyField = (key: string, rules: Rule[]) => {
    const h = findNumber(file, rules);
    const v = h && money(h.value, cur);
    record(key, h, v);
    return v;
  };
  const numField = (key: string, rules: Rule[]) => {
    const h = findNumber(file, rules);
    record(key, h, h?.value);
    return h?.value;
  };

  const metrics: FinancialMetrics = {
    revenue: moneyField("revenue", [{ label: /^Revenue/i }]),
    ebitda: moneyField("ebitda", [{ label: /^EBITDA(?! margin)/i }]),
    totalDebt: moneyField("totalDebt", [{ label: /^Total financial debt/i }]),
    cash: moneyField("cash", [{ label: /^Cash and equivalents/i }]),
    netDebt: moneyField("netDebt", [{ label: /^Net financial debt/i }]),
    leverage: numField("leverage", [{ label: /^Total debt \/ EBITDA/i }, { label: /^Leverage/i }]),
    nplRatio: numField("nplRatio", [{ label: /^NPL ratio/i }]),
  };
  for (const k of Object.keys(metrics) as (keyof FinancialMetrics)[])
    if (metrics[k] === undefined) delete metrics[k];

  const npe = moneyField("nonPerformingExposure", [{ label: /^Non-performing exposure/i }]);
  const periodHit = findText(file, [PERIOD_RULE]);
  record("reportingPeriod", periodHit, periodHit?.value);

  return { period: periodHit?.value, metrics, nonPerformingExposure: npe, fields };
}

export interface ManagementReportExtraction {
  period?: string;
  currency: string;
  /** All amounts in millions. */
  revenue?: number;
  ebitda?: number;
  cash?: number;
  adjustedDebt?: number;
  adjustedNetDebt?: number;
  adjustedLeverage?: number;
  adjustedNplRatio?: number;
  reclassifiedAmount?: number;
  reclassifiedCounterparty?: string;
  reportedNonPerforming?: number;
  timingDifference?: number;
  adjustedNonPerforming?: number;
  commentary?: string;
  evidence: { key: string; label: string; excerpt: string; location: Loc }[];
  fields: Record<string, ExtractedField>;
}

const D = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const rx = (src: string) => new RegExp(src, "i");

export function extractManagementReport(file: ParsedFile): ManagementReportExtraction {
  const currency = currencyOf(file);
  const fields: Record<string, ExtractedField> = {};
  const evidence: ManagementReportExtraction["evidence"] = [];

  const num = (
    key: string,
    label: string,
    rules: Rule[],
    opts: { decimals?: number; asMoney?: boolean; evidence?: boolean } = {},
  ) => {
    const h = findNumber(file, rules);
    if (!h) return undefined;
    const value = round(h.value, opts.decimals ?? 2);
    fields[key] = {
      value: opts.asMoney ? money(value, currency) : value,
      sourceDocumentId: "",
      sourceLocation: locOf(h.line),
      confidence: h.confidence,
    };
    if (opts.evidence)
      evidence.push({ key, label, excerpt: h.line.text.slice(0, 180), location: locOf(h.line) });
    return value;
  };

  const revenue = num(
    "revenue",
    "Revenue",
    [{ label: /^Revenue/i }, { capture: rx(String.raw`Revenue[^.]{0,60}?USD\s*${D}\s*million`) }],
    { asMoney: true },
  );
  const ebitda = num(
    "ebitda",
    "EBITDA",
    [
      { label: /^EBITDA(?! margin)/i },
      { capture: rx(String.raw`EBITDA was USD\s*${D}\s*million`) },
    ],
    { asMoney: true },
  );
  const cash = num(
    "cash",
    "Cash and equivalents",
    [
      { label: /^Cash and equivalents/i },
      { capture: rx(String.raw`USD\s*${D}\s*million of cash`) },
    ],
    { asMoney: true },
  );

  const reclassifiedAmount = num(
    "reclassifiedAmount",
    "Intercompany cash tranche (excluded from debt)",
    [
      { label: /^Less: intercompany cash tranche/i },
      { capture: rx(String.raw`USD\s*${D}\s*million shown as group funding`) },
    ],
    { asMoney: true, evidence: true },
  );
  const adjustedDebt = num(
    "adjustedDebt",
    "Adjusted financial debt",
    [
      { label: /^Adjusted financial debt/i },
      { capture: rx(String.raw`adjusted financial debt is USD\s*${D}`) },
    ],
    { asMoney: true, evidence: true },
  );
  const adjustedNetDebt = num(
    "adjustedNetDebt",
    "Adjusted net financial debt",
    [
      { label: /^Net financial debt \(adjusted\)/i },
      { capture: rx(String.raw`Adjusted net financial debt[\s\S]{0,80}?\bis USD\s*${D}`) },
    ],
    { asMoney: true },
  );
  const adjustedLeverage = num(
    "adjustedLeverage",
    "Adjusted leverage",
    [
      { label: /^Adjusted leverage/i },
      { capture: rx(String.raw`adjusted leverage is\s*${D}\s*x`) },
    ],
    { decimals: 1 },
  );
  const adjustedNplRatio = num(
    "adjustedNplRatio",
    "Adjusted NPL ratio",
    [
      { label: /^Adjusted NPL ratio/i },
      { capture: rx(String.raw`adjusted NPL ratio of\s*${D}\s*%`) },
    ],
    { decimals: 1, evidence: true },
  );
  const reportedNonPerforming = num(
    "reportedNonPerforming",
    "Non-performing exposure per financing report",
    [
      { label: /^Non-performing exposure per financing report/i },
      { capture: rx(String.raw`Of the USD\s*${D}\s*million non-performing exposure`) },
    ],
    { asMoney: true },
  );
  const timingDifference = num(
    "timingDifference",
    "Cash-pool clearing timing difference",
    [
      { label: /^Of which: cash-pool clearing timing difference/i },
      {
        capture: rx(
          String.raw`USD\s*${D}\s*million relates to a month-end clearing timing difference`,
        ),
      },
    ],
    { asMoney: true, evidence: true },
  );
  const adjustedNonPerforming = num(
    "adjustedNonPerforming",
    "Adjusted non-performing exposure",
    [
      { label: /^Adjusted non-performing exposure/i },
      { capture: rx(String.raw`Adjusted non-performing exposure is therefore USD\s*${D}`) },
    ],
    { asMoney: true },
  );

  const cp = findText(file, [
    /(?:Cash-pool tranche\s*[-–]\s*|placed by\s+)([A-Z][^|,;]*?(?:Sp\. z o\.o\.|S\.A\.|GmbH|Ltd\.?|LLC|Inc\.?))/,
  ]);
  if (cp)
    fields.reclassifiedCounterparty = {
      value: cp.value,
      sourceDocumentId: "",
      sourceLocation: locOf(cp.line),
      confidence: cp.confidence,
    };

  const periodHit = findText(file, [PERIOD_RULE]);
  if (periodHit)
    fields.reportingPeriod = {
      value: periodHit.value,
      sourceDocumentId: "",
      sourceLocation: locOf(periodHit.line),
      confidence: periodHit.confidence,
    };

  // Narrative explaining the reclassification: prose paragraphs (DOCX) or a "Note:" row (XLSX), never table rows.
  const commentary = file.lines
    .filter(
      (l) =>
        l.text.length > 80 &&
        /cash[- ]pool/i.test(l.text) &&
        (!l.text.includes(" | ") || /^Note:/i.test(l.text)),
    )
    .slice(0, 2)
    .map((l) => l.text.replace(/^Note:\s*/i, ""))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join("\n\n");

  return {
    period: periodHit?.value,
    currency,
    revenue,
    ebitda,
    cash,
    adjustedDebt,
    adjustedNetDebt,
    adjustedLeverage,
    adjustedNplRatio,
    reclassifiedAmount,
    reclassifiedCounterparty: cp?.value,
    reportedNonPerforming,
    timingDifference,
    adjustedNonPerforming,
    commentary: commentary || undefined,
    evidence,
    fields,
  };
}

export interface TeaserExtraction {
  fields: Record<string, ExtractedField>;
  ltmRevenue?: Money;
  ltmEbitda?: Money;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(s: string): string | undefined {
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s.trim());
  if (iso) return iso[0];
  let d: number | undefined, mon: string | undefined, y: number | undefined;
  let m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})/.exec(s);
  if (m) [d, mon, y] = [Number(m[1]), m[2], Number(m[3])];
  else if ((m = /([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(s)))
    [mon, d, y] = [m[1], Number(m[2]), Number(m[3])];
  if (!mon || !d || !y) return undefined;
  const i = MONTHS.indexOf(mon.toLowerCase().slice(0, 3));
  return i < 0 ? undefined : `${y}-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function inferDealType(text: string): TDealType {
  const t = text.toLowerCase();
  if (t.includes("unitranche")) return "unitranche";
  if (t.includes("second lien") || t.includes("second-lien")) return "second_lien";
  if (t.includes("mezzanine")) return "mezzanine";
  if (/asset[- ]based/.test(t)) return "asset_based";
  if (t.includes("senior")) return "senior_secured";
  return "other";
}

const UNIT: Record<string, number> = { million: 1, m: 1, mm: 1, billion: 1000, bn: 1000, b: 1000 };

export function extractTeaser(file: ParsedFile): TeaserExtraction {
  const fields: Record<string, ExtractedField> = {};
  const set = (key: string, hit: Hit | undefined, value: unknown = hit?.value) => {
    if (hit && value !== undefined && value !== "")
      fields[key] = {
        value,
        sourceDocumentId: "",
        sourceLocation: locOf(hit.line),
        confidence: hit.confidence,
      };
  };

  const title = findText(file, [/^PROJECT\s+([A-Za-z]+)\s*$/], 0.97);
  if (title)
    set(
      "name",
      title,
      `Project ${title.value[0].toUpperCase()}${title.value.slice(1).toLowerCase()}`,
    );
  set("borrowerName", findText(file, [/^Borrower:\s*(.+)$/i], 0.98));
  set("industry", findText(file, [/^Industry:\s*(.+)$/i], 0.97));
  set("location", findText(file, [/^Location:\s*(.+)$/i], 0.97));
  const site = findText(file, [/^Website:\s*(\S+)/i], 0.97);
  if (site)
    set("websiteUrl", site, /^https?:/.test(site.value) ? site.value : `https://${site.value}`);

  const fac = findText(file, [/^Facility requested:\s*(.+)$/i], 0.95);
  if (fac) {
    const m = /([A-Z]{3})\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion|mm|bn|m|b)?\s*(.*)/i.exec(
      fac.value,
    );
    if (m) {
      const factor = UNIT[(m[3] ?? "million").toLowerCase()] ?? 1;
      set("requestedAmount", fac, money(toNum(m[2]) * factor, m[1].toUpperCase()));
      set("dealType", fac, inferDealType(m[4] || fac.value));
    }
  }

  const close = findText(file, [/^Target closing:\s*(.+)$/i], 0.95);
  if (close) set("targetCloseDate", close, parseDate(close.value));

  const metric = (label: string) => {
    const h = findText(file, [
      new RegExp(
        `^${label}:\\s*([A-Z]{3}\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:million|billion|mm|bn|m|b)?)`,
        "i",
      ),
    ]);
    const m =
      h && /([A-Z]{3})\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion|mm|bn|m|b)?/i.exec(h.value);
    return m
      ? money(toNum(m[2]) * (UNIT[(m[3] ?? "million").toLowerCase()] ?? 1), m[1].toUpperCase())
      : undefined;
  };

  // Description: the lines between "Business overview" and the next short heading.
  const start = file.lines.findIndex((l) => /^Business overview$/i.test(l.text));
  if (start >= 0) {
    const body: string[] = [];
    for (const l of file.lines.slice(start + 1)) {
      if (/^[A-Z][A-Za-z]*(?: [A-Za-z]+){0,3}$/.test(l.text)) break;
      body.push(l.text);
    }
    if (body.length)
      set(
        "description",
        { value: "", line: file.lines[start + 1], confidence: 0.85 },
        body.join(" "),
      );
  }

  return { fields, ltmRevenue: metric("LTM revenue"), ltmEbitda: metric("LTM EBITDA") };
}
