import type { ActivityEvent, TActivityType } from "../types/activity";
import type { Adjustment, AdjustmentEvidence } from "../types/adjustments";
import type { Money } from "../types/common";
import type { Cycle } from "../types/cycles";
import type { Deal, TDealStage } from "../types/deals";
import type { TRiskLevel } from "../types/common";
import {
  DILIGENCE_BLOCK_TYPES,
  type DiligenceBlock,
  type FinancialMetrics,
} from "../types/diligence";
import type { DealDocument, ExtractedField, TDocumentType } from "../types/documents";
import type { Finding, TFinancialAdjustment } from "../types/findings";
import type { AppNotification } from "../types/notifications";
import { DEMO_LOGIN_USER_IDS, computeReadiness, makeBlock, roleBlurbs } from "../data/seed";
import { applyChanges, deriveRisk } from "../lib/adjustments";
import { AI_ACTOR_ID, DEMO_TODAY, FUND_POLICY, RISK_META, STAGES } from "../lib/deal-meta";
import { formatMoney } from "../lib/format";
import { describeFields, locationLabel, type ExtractedSummaryItem } from "../parsing/describe";
import {
  extractFinancingReport,
  extractManagementReport,
  extractTeaser,
  type FinancingReportExtraction,
  type ManagementReportExtraction,
} from "../parsing/extractors";
import { readFile } from "../parsing/readFile";
import type { ParsedFile } from "../parsing/types";
import { memosApi } from "./memos";
import { readDb, resetDb, writeDb, type Db } from "./storage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => 150 + Math.random() * 250;

// Imitates a network call
async function respond<T>(fn: () => T, ms = latency()): Promise<T> {
  await sleep(ms);
  return structuredClone(fn());
}

const SESSION_KEY = "underwrite:session";
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const nowIso = () => new Date().toISOString();
const auditNew = (by: string) => {
  const t = nowIso();
  return { createdAt: t, createdBy: by, updatedAt: t, updatedBy: by };
};
const money = (millions: number, currency: string): Money => ({
  amount: Math.round(millions * 1e6),
  currency,
});
const prune = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

type FinancialBlock = Extract<DiligenceBlock, { type: "financial_analysis" }>;
type MgmtBlock = Extract<DiligenceBlock, { type: "management_reporting" }>;
const findFin = (db: Db, dealId: string) =>
  db.diligenceBlocks.find(
    (b): b is FinancialBlock => b.dealId === dealId && b.type === "financial_analysis",
  );
const findMgmt = (db: Db, dealId: string) =>
  db.diligenceBlocks.find(
    (b): b is MgmtBlock => b.dealId === dealId && b.type === "management_reporting",
  );

function log(
  db: Db,
  dealId: string,
  actorId: string,
  type: TActivityType,
  summary: string,
  entityType?: ActivityEvent["entityType"],
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  db.activity.push({
    id: newId("act"),
    dealId,
    actorId,
    type,
    timestamp: nowIso(),
    summary,
    entityType,
    entityId,
    metadata,
  });
}

function touchDeal(db: Db, dealId: string, actorId: string, patch: Partial<Deal> = {}) {
  const d = db.deals.find((x) => x.id === dealId)!;
  Object.assign(d, patch, { updatedAt: nowIso(), updatedBy: actorId });
  d.diligenceReadiness = computeReadiness(db.diligenceBlocks.filter((b) => b.dealId === dealId));
  return d;
}

export type DealSortKey =
  "name" | "stage" | "amount" | "risk" | "readiness" | "icDate" | "updatedAt";

export interface DealListParams {
  cycleId?: string; // id | "all" | "none"
  q?: string;
  stages?: TDealStage[];
  risks?: TRiskLevel[];
  ownerId?: string;
  sort?: DealSortKey;
  dir?: "asc" | "desc";
}

export interface DealListResponse {
  items: Deal[];
  total: number;
}

const stageIndex = (d: Deal) => STAGES.findIndex((s) => s.id === d.workflow.stage);
const comparators: Record<DealSortKey, (a: Deal, b: Deal) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  stage: (a, b) => stageIndex(a) - stageIndex(b),
  amount: (a, b) => (a.requestedAmount?.amount ?? 0) - (b.requestedAmount?.amount ?? 0),
  risk: (a, b) => RISK_META[a.riskLevel].order - RISK_META[b.riskLevel].order,
  readiness: (a, b) => a.diligenceReadiness - b.diligenceReadiness,
  icDate: (a, b) => (a.nextIcDate ?? "9999").localeCompare(b.nextIcDate ?? "9999"),
  updatedAt: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
};

export type CreateDealInput = Pick<Deal, "name" | "borrowerName" | "workflow" | "ownerId"> &
  Partial<
    Omit<
      Deal,
      | "id"
      | "name"
      | "borrowerName"
      | "workflow"
      | "ownerId"
      | keyof import("../types/common").AuditMetadata
    >
  >;

export const UPLOAD_STEPS = [
  "Uploading file",
  "Reading document",
  "Extracting data",
  "Cross-checking against deal data",
  "Generating insights",
];
export const TEASER_STEPS = ["Uploading teaser", "Reading document", "Extracting deal fields"];

export interface UploadResult {
  document: DealDocument;
  summary: ExtractedSummaryItem[];
  adjustment?: Adjustment;
  notification?: AppNotification;
  message: string;
}

export type UserNotification = AppNotification & { read: boolean };

export interface TeaserParseResult {
  fields: Record<string, ExtractedField>;
  summary: ExtractedSummaryItem[];
  ltmRevenue?: Money;
  ltmEbitda?: Money;
  file: { name: string; sizeBytes: number; mimeType: string };
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const mimeOf = (f: { name: string; type?: string }) =>
  f.type || MIME[f.name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";

function upsertBreachFindings(
  db: Db,
  deal: Deal,
  block: FinancialBlock,
  m: FinancialMetrics,
  docId: string,
  actorId: string,
) {
  const checks = [
    {
      breach: (m.nplRatio ?? 0) > FUND_POLICY.maxNplRatio,
      title: "NPL ratio exceeds fund limit",
      description: `Financing report shows an NPL ratio of ${m.nplRatio}% versus the fund limit of ${FUND_POLICY.maxNplRatio}%.`,
    },
    {
      breach: (m.leverage ?? 0) > FUND_POLICY.maxLeverage,
      title: "Leverage above policy limit",
      description: `Total debt of ${formatMoney(m.totalDebt)} against EBITDA of ${formatMoney(m.ebitda)} implies ${m.leverage}x leverage (policy max ${FUND_POLICY.maxLeverage}x).`,
    },
  ];
  for (const c of checks) {
    if (!c.breach) continue;
    const existing = db.findings.find((f) => f.dealId === deal.id && f.title === c.title);
    if (existing) {
      existing.description = c.description;
      existing.updatedAt = nowIso();
      if (existing.status === "resolved") existing.status = "open";
      if (!existing.sourceDocumentIds.includes(docId)) existing.sourceDocumentIds.push(docId);
      continue;
    }
    const f: Finding = {
      ...auditNew(actorId),
      id: newId("fnd"),
      dealId: deal.id,
      title: c.title,
      description: c.description,
      source: "rule",
      status: "open",
      severity: "high",
      sourceDocumentIds: [docId],
      relatedBlockIds: [block.id],
    };
    db.findings.push(f);
    block.findingIds.push(f.id);
    log(db, deal.id, actorId, "finding_created", `Rule flagged: ${c.title}`, "finding", f.id);
  }
}

function ingestFinancingReport(
  db: Db,
  deal: Deal,
  doc: DealDocument,
  ex: FinancingReportExtraction,
  actorId: string,
) {
  const block = findFin(db, deal.id);
  if (!block) return { message: "This deal has no financial analysis block." };
  block.content = {
    ...block.content,
    reportingPeriod: ex.period ?? block.content.reportingPeriod,
    metrics: { ...block.content.metrics, ...ex.metrics },
  };
  block.readiness = "needs_review";
  if (!block.documentIds.includes(doc.id)) block.documentIds.push(doc.id);
  block.updatedAt = nowIso();
  db.adjustments
    .filter((a) => a.blockId === block.id && a.status === "proposed")
    .forEach((a) => (a.status = "superseded"));
  upsertBreachFindings(db, deal, block, block.content.metrics, doc.id, actorId);
  touchDeal(db, deal.id, actorId, { riskLevel: deriveRisk(block.content.metrics) });
  return {
    message: `Financial analysis updated from ${Object.keys(ex.metrics).length} extracted metrics.`,
  };
}

const evidenceOf = (ex: ManagementReportExtraction, docId: string): AdjustmentEvidence[] =>
  ex.evidence.map((e) => ({
    label: e.label,
    documentId: docId,
    location: locationLabel(e.location),
    excerpt: e.excerpt,
  }));

function ingestManagementReport(
  db: Db,
  deal: Deal,
  doc: DealDocument,
  ex: ManagementReportExtraction,
  kind: ParsedFile["kind"],
  actorId: string,
): { adjustment?: Adjustment; notification?: AppNotification; message: string } {
  const mgmt = findMgmt(db, deal.id);
  const fin = findFin(db, deal.id);
  if (!mgmt) return { message: "This deal has no management reporting block." };

  const cur = fin?.content.metrics;
  const cc = ex.currency;
  const reported = cur?.totalDebt ? cur.totalDebt.amount / 1e6 : undefined;
  const adjustedDebt =
    ex.adjustedDebt ??
    (reported !== undefined && ex.reclassifiedAmount !== undefined
      ? reported - ex.reclassifiedAmount
      : undefined);
  const reclass =
    ex.reclassifiedAmount ??
    (reported !== undefined && ex.adjustedDebt !== undefined
      ? reported - ex.adjustedDebt
      : undefined);
  const discrepancy =
    reported !== undefined &&
    adjustedDebt !== undefined &&
    reclass !== undefined &&
    reclass > 0 &&
    reclass / reported >= 0.05;

  const mm = (v?: number) => (v === undefined ? undefined : money(v, cc));
  const old = mgmt.content;
  mgmt.content = {
    ...old,
    reportingPeriod: ex.period ?? old.reportingPeriod,
    metrics: {
      ...old.metrics,
      ...prune({
        revenue: mm(ex.revenue),
        ebitda: mm(ex.ebitda),
        cash: mm(ex.cash),
        totalDebt: mm(adjustedDebt),
        netDebt: mm(ex.adjustedNetDebt),
        leverage: ex.adjustedLeverage,
        nplRatio: ex.adjustedNplRatio,
      }),
    },
    commentary:
      ex.commentary && !old.commentary?.includes(ex.commentary.slice(0, 40))
        ? [old.commentary, ex.commentary].filter(Boolean).join("\n\n")
        : old.commentary,
    reconciliationStatus: discrepancy
      ? "discrepancy_found"
      : reported !== undefined
        ? "reconciled"
        : "in_progress",
  };
  mgmt.readiness = discrepancy
    ? "needs_review"
    : reported !== undefined
      ? "complete"
      : "in_progress";
  if (!mgmt.documentIds.includes(doc.id)) mgmt.documentIds.push(doc.id);
  mgmt.updatedAt = nowIso();

  if (
    !discrepancy ||
    !fin ||
    !cur ||
    reported === undefined ||
    adjustedDebt === undefined ||
    reclass === undefined
  ) {
    touchDeal(db, deal.id, actorId);
    return {
      message:
        reported !== undefined
          ? "Management figures reconcile with the financing report."
          : "Management report parsed.",
    };
  }

  const pending = db.adjustments.find((a) => a.blockId === fin.id && a.status === "proposed");
  if (pending) {
    pending.confidence = Math.min(0.97, Math.round((pending.confidence + 0.07) * 100) / 100);
    pending.evidence.push(...evidenceOf(ex, doc.id));
    pending.updatedAt = nowIso();
    touchDeal(db, deal.id, actorId);
    return {
      adjustment: pending,
      message: "Second source confirms the pending AI suggestion. Confidence increased.",
    };
  }

  const fmt = (m: number) => formatMoney(money(m, cc));
  const ebitdaM = cur.ebitda ? cur.ebitda.amount / 1e6 : undefined;
  const adjLeverage =
    ex.adjustedLeverage ?? (ebitdaM ? Math.round((adjustedDebt / ebitdaM) * 10) / 10 : undefined);

  const changes: TFinancialAdjustment[] = [
    { targetMetric: "total_debt", operation: "subtract", value: money(reclass, cc) },
  ];
  if (cur.netDebt)
    changes.push({ targetMetric: "net_debt", operation: "subtract", value: money(reclass, cc) });
  if (adjLeverage !== undefined)
    changes.push({ targetMetric: "leverage", operation: "replace", value: adjLeverage });
  if (ex.adjustedNplRatio !== undefined)
    changes.push({ targetMetric: "npl_ratio", operation: "replace", value: ex.adjustedNplRatio });

  const before = structuredClone(cur);
  const after = applyChanges(before, changes);
  const cp = ex.reclassifiedCounterparty;
  const rationale = [
    `The management report shows that ${fmt(reclass)} of the ${fmt(reported)} of debt in the financing report is a cash tranche${cp ? ` placed by ${cp}` : ""} under a group cash-pooling arrangement, not borrowed money.`,
    `Excluding it, financial debt is ${fmt(adjustedDebt)}${adjLeverage !== undefined ? ` and leverage ${adjLeverage}x (policy max ${FUND_POLICY.maxLeverage}x)` : ""}.`,
    ex.timingDifference !== undefined && ex.adjustedNplRatio !== undefined
      ? `${fmt(ex.timingDifference)} of the flagged non-performing exposure was a month-end clearing timing difference, which brings the NPL ratio to ${ex.adjustedNplRatio}% (fund limit ${FUND_POLICY.maxNplRatio}%).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const adjId = newId("adj");
  const aiFinding: Finding = {
    ...auditNew(AI_ACTOR_ID),
    id: newId("fnd"),
    dealId: deal.id,
    title: "Reported debt includes intercompany cash tranche",
    description: `${fmt(reclass)} of the reported ${fmt(reported)} is a group cash-pool balance, not financial indebtedness.`,
    source: "ai_analysis",
    status: "open",
    severity: "moderate",
    sourceDocumentIds: [doc.id],
    relatedBlockIds: [fin.id, mgmt.id],
    suggestedAdjustmentId: adjId,
  };
  db.findings.push(aiFinding);
  const related = db.findings.filter(
    (f) =>
      f.dealId === deal.id &&
      f.id !== aiFinding.id &&
      f.relatedBlockIds.includes(fin.id) &&
      (f.status === "open" || f.status === "under_review"),
  );
  related.forEach((f) => (f.suggestedAdjustmentId = adjId));
  fin.findingIds.push(aiFinding.id);
  mgmt.findingIds.push(aiFinding.id);

  const adjustment: Adjustment = {
    ...auditNew(AI_ACTOR_ID),
    id: adjId,
    dealId: deal.id,
    blockId: fin.id,
    findingIds: [aiFinding.id, ...related.map((f) => f.id)],
    status: "proposed",
    title: `Reclassify ${fmt(reclass)} intercompany cash tranche out of financial debt`,
    rationale,
    confidence: kind === "docx" ? 0.9 : 0.88,
    changes,
    before,
    after,
    evidence: evidenceOf(ex, doc.id),
    riskBefore: deal.riskLevel,
    riskAfter: deriveRisk(after),
  };
  db.adjustments.push(adjustment);

  const partners = db.users.filter((u) => u.roleId === "role-partner").map((u) => u.id);
  const notification: AppNotification = {
    id: newId("ntf"),
    dealId: deal.id,
    kind: "ai_suggestion",
    severity: "warning",
    title: `Discrepancy found on ${deal.name}`,
    body: `The management report shows ${fmt(reclass)} of the reported debt is an intragroup cash tranche. AI suggests an adjustment: debt ${fmt(reported)} → ${fmt(adjustedDebt)}.`,
    createdAt: nowIso(),
    recipientIds: [...new Set([deal.ownerId, ...deal.teamMemberIds, ...partners])],
    readBy: [],
    adjustmentId: adjId,
  };
  db.notifications.unshift(notification);

  log(
    db,
    deal.id,
    AI_ACTOR_ID,
    "finding_created",
    "AI flagged: reported debt includes an intercompany cash tranche",
    "finding",
    aiFinding.id,
  );
  touchDeal(db, deal.id, actorId);
  return {
    adjustment,
    notification,
    message: "AI found a discrepancy and prepared a suggested adjustment.",
  };
}

export const api = {
  auth: {
    async listDemoPersonas() {
      return respond(() => {
        const db = readDb();
        return DEMO_LOGIN_USER_IDS.map((id) => {
          const user = db.users.find((u) => u.id === id)!;
          const role = db.roles.find((r) => r.id === user.roleId)!;
          return { user, role, blurb: roleBlurbs[role.id] ?? "" };
        });
      }, 100);
    },
    async login(userId: string) {
      await sleep(250);
      if (!readDb().users.some((u) => u.id === userId)) throw new Error("Unknown user");
      sessionStorage.setItem(SESSION_KEY, userId);
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },
    async me() {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const db = readDb();
      const user = db.users.find((u) => u.id === id);
      const role = db.roles.find((r) => r.id === user?.roleId);
      return user && role ? { user: structuredClone(user), role: structuredClone(role) } : null;
    },
  },

  system: {
    reset() {
      resetDb();
    },
  },

  users: { list: () => respond(() => readDb().users, 80) },

  cycles: {
    list: () => respond(() => readDb().cycles, 80),
    current: (): Promise<Cycle | undefined> =>
      respond(
        () =>
          readDb().cycles.find(
            (c) => c.status === "active" && c.startDate <= DEMO_TODAY && DEMO_TODAY <= c.endDate,
          ),
        50,
      ),
  },

  deals: {
    list: (p: DealListParams = {}) =>
      respond((): DealListResponse => {
        const q = p.q?.trim().toLowerCase();
        let items = readDb().deals.filter((d) => {
          if (p.cycleId && p.cycleId !== "all") {
            if (p.cycleId === "none" ? d.cycleId : d.cycleId !== p.cycleId) return false;
          }
          if (p.stages?.length && !p.stages.includes(d.workflow.stage)) return false;
          if (p.risks?.length && !p.risks.includes(d.riskLevel)) return false;
          if (p.ownerId && d.ownerId !== p.ownerId) return false;
          if (
            q &&
            ![d.name, d.borrowerName, d.industry, d.location, ...d.tags].some((v) =>
              v?.toLowerCase().includes(q),
            )
          )
            return false;
          return true;
        });
        const cmp = comparators[p.sort ?? "updatedAt"];
        const sign = p.dir === "asc" ? 1 : -1;
        items = items.sort((a, b) => sign * cmp(a, b));
        return { items, total: items.length };
      }),

    getBundle: (id: string) =>
      respond(() => {
        const db = readDb();
        const deal = db.deals.find((d) => d.id === id);
        if (!deal) return null;
        return {
          deal,
          cycle: db.cycles.find((c) => c.id === deal.cycleId),
          securities: db.securities.filter((s) => s.dealId === id),
          blocks: db.diligenceBlocks.filter((b) => b.dealId === id),
          documents: db.documents.filter((d) => d.dealId === id),
          findings: db.findings.filter((f) => f.dealId === id),
          adjustments: db.adjustments.filter((a) => a.dealId === id),
          activity: db.activity
            .filter((a) => a.dealId === id)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
        };
      }),

    create: (
      input: CreateDealInput,
      actorId: string,
      teaser?: { file: TeaserParseResult["file"]; fields: Record<string, ExtractedField> },
    ) =>
      respond(() => {
        const db = readDb();
        const id = newId("deal");
        const deal: Deal = {
          teamMemberIds: [],
          riskLevel: "unknown",
          diligenceReadiness: 0,
          tags: [],
          ...input,
          id,
          ...auditNew(actorId),
        };
        db.deals.unshift(deal);
        db.diligenceBlocks.push(
          ...DILIGENCE_BLOCK_TYPES.map((t) =>
            makeBlock(id, t, "not_started", deal.ownerId, undefined, deal.createdAt),
          ),
        );
        log(
          db,
          id,
          actorId,
          "deal_created",
          `Deal created: ${deal.name}${teaser ? " from teaser" : ""}`,
          "deal",
          id,
        );
        if (teaser) {
          const docId = newId("doc");
          for (const f of Object.values(teaser.fields)) f.sourceDocumentId = docId;
          db.documents.push({
            ...auditNew(actorId),
            id: docId,
            dealId: id,
            name: teaser.file.name,
            type: "teaser",
            mimeType: teaser.file.mimeType,
            sizeBytes: teaser.file.sizeBytes,
            uploadedBy: actorId,
            uploadedAt: nowIso(),
            processingStatus: "parsed",
            extractedFields: teaser.fields,
          });
          log(
            db,
            id,
            actorId,
            "document_parsed",
            `Teaser parsed: ${Object.keys(teaser.fields).length} fields extracted`,
            "document",
            docId,
          );
        }
        writeDb(db);
        return deal;
      }, 450),

    update: (id: string, patch: Partial<Deal>, actorId: string) =>
      respond(() => {
        const db = readDb();
        const d = touchDeal(db, id, actorId, patch);
        writeDb(db);
        return d;
      }, 300),
  },

  documents: {
    async upload(args: {
      dealId: string;
      file: File;
      type: TDocumentType;
      actorId: string;
      onStep?: (stepIndex: number) => void;
    }): Promise<UploadResult> {
      const { dealId, file, type, actorId, onStep } = args;
      const step = async (i: number, ms: number) => {
        onStep?.(i);
        await sleep(ms);
      };

      await step(0, 500);
      await step(1, 250);
      const parsed = await readFile(file);
      await step(2, 600);
      const fin = type === "financing_report" ? extractFinancingReport(parsed) : undefined;
      const mgmt = type === "management_report" ? extractManagementReport(parsed) : undefined;
      const fields = fin?.fields ?? mgmt?.fields ?? {};
      await step(3, 700);
      await step(4, 500);

      const db = readDb();
      const deal = db.deals.find((d) => d.id === dealId);
      if (!deal) throw new Error("Deal not found");

      const docId = newId("doc");
      for (const f of Object.values(fields)) f.sourceDocumentId = docId;
      const recognised = fin
        ? Object.keys(fin.metrics).length > 0
        : mgmt
          ? ["revenue", "ebitda", "adjustedDebt", "reclassifiedAmount", "adjustedNplRatio"].some(
              (k) => k in fields,
            )
          : true;

      const document: DealDocument = {
        ...auditNew(actorId),
        id: docId,
        dealId,
        name: file.name,
        type,
        mimeType: mimeOf(file),
        sizeBytes: file.size,
        uploadedBy: actorId,
        uploadedAt: nowIso(),
        processingStatus: recognised ? "parsed" : "failed",
        processingError: recognised
          ? undefined
          : "No recognisable financial data found in this document.",
        extractedFields: Object.keys(fields).length ? fields : undefined,
      };
      db.documents.push(document);
      log(db, dealId, actorId, "document_uploaded", `Uploaded ${file.name}`, "document", docId);

      let message = recognised
        ? `Parsed ${file.name}.`
        : "The document was uploaded but nothing could be extracted.";
      let adjustment: Adjustment | undefined;
      let notification: AppNotification | undefined;
      if (recognised) {
        log(
          db,
          dealId,
          actorId,
          "document_parsed",
          `Parsed ${file.name}: ${Object.keys(fields).length} fields extracted`,
          "document",
          docId,
        );
        if (fin) message = ingestFinancingReport(db, deal, document, fin, actorId).message;
        if (mgmt)
          ({ adjustment, notification, message } = ingestManagementReport(
            db,
            deal,
            document,
            mgmt,
            parsed.kind,
            actorId,
          ));
        touchDeal(db, dealId, actorId);
      }
      writeDb(db);
      onStep?.(UPLOAD_STEPS.length);
      return structuredClone({
        document,
        summary: describeFields(fields),
        adjustment,
        notification,
        message,
      });
    },

    async parseTeaser(
      file: File,
      onStep?: (stepIndex: number) => void,
    ): Promise<TeaserParseResult> {
      onStep?.(0);
      await sleep(500);
      onStep?.(1);
      const parsed = await readFile(file);
      onStep?.(2);
      await sleep(700);
      const t = extractTeaser(parsed);
      onStep?.(TEASER_STEPS.length);
      return {
        fields: t.fields,
        summary: describeFields(t.fields),
        ltmRevenue: t.ltmRevenue,
        ltmEbitda: t.ltmEbitda,
        file: { name: file.name, sizeBytes: file.size, mimeType: mimeOf(file) },
      };
    },
  },

  adjustments: {
    decide: (id: string, decision: "accepted" | "rejected", actorId: string, comment?: string) =>
      respond(() => {
        const db = readDb();
        const adj = db.adjustments.find((a) => a.id === id);
        if (!adj || adj.status !== "proposed")
          throw new Error("This suggestion is no longer pending.");
        const now = nowIso();
        Object.assign(adj, {
          status: decision,
          decidedBy: actorId,
          decidedAt: now,
          decisionComment: comment || undefined,
          updatedAt: now,
          updatedBy: actorId,
        });

        const fin = findFin(db, adj.dealId);
        const mgmt = findMgmt(db, adj.dealId);
        const accepted = decision === "accepted";

        for (const f of db.findings.filter((x) => adj.findingIds.includes(x.id))) {
          const isAi =
            f.source === "ai_analysis" &&
            f.suggestedAdjustmentId === adj.id &&
            f.title.startsWith("Reported debt");
          if (!accepted && !isAi) continue;
          f.status = accepted ? (isAi ? "accepted" : "resolved") : "rejected";
          Object.assign(f, {
            reviewerId: actorId,
            reviewedAt: now,
            reviewerComment: comment || undefined,
            updatedAt: now,
            updatedBy: actorId,
          });
        }
        if (accepted && fin) {
          fin.content = { ...fin.content, metrics: adj.after };
          fin.readiness = "complete";
        }
        if (accepted && mgmt) {
          mgmt.content = { ...mgmt.content, reconciliationStatus: "reconciled" };
          mgmt.readiness = "complete";
        }
        const deal = touchDeal(
          db,
          adj.dealId,
          actorId,
          accepted ? { riskLevel: adj.riskAfter } : {},
        );
        log(
          db,
          adj.dealId,
          actorId,
          accepted ? "adjustment_accepted" : "adjustment_rejected",
          `${accepted ? "Accepted" : "Declined"} AI suggestion: ${adj.title}`,
          "adjustment",
          adj.id,
          { riskBefore: adj.riskBefore, riskAfter: adj.riskAfter },
        );
        db.notifications
          .filter((n) => n.adjustmentId === id)
          .forEach((n) => {
            if (!n.readBy.includes(actorId)) n.readBy.push(actorId);
          });
        writeDb(db);
        return { adjustment: adj, deal };
      }, 500),
  },

  notifications: {
    listFor: (userId: string) =>
      respond(
        (): UserNotification[] =>
          readDb()
            .notifications.filter((n) => n.recipientIds.includes(userId))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((n) => ({ ...n, read: n.readBy.includes(userId) })),
        0,
      ),
    markRead: (id: string, userId: string) =>
      respond(() => {
        const db = readDb();
        const n = db.notifications.find((x) => x.id === id);
        if (n && !n.readBy.includes(userId)) n.readBy.push(userId);
        writeDb(db);
      }, 0),
    markAllRead: (userId: string) =>
      respond(() => {
        const db = readDb();
        db.notifications.forEach((n) => {
          if (n.recipientIds.includes(userId) && !n.readBy.includes(userId)) n.readBy.push(userId);
        });
        writeDb(db);
      }, 0),
  },

  memos: memosApi,
};
