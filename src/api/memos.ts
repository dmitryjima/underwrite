import type { ICMemo, TMemoStatus, TMemoType } from "../types/memos";
import { generateSections, memoTitle } from "../memo/generate";
import { MEMO_TRANSITIONS, MEMO_TYPE_LABEL, isEditable } from "../lib/memo-meta";
import { readDb, writeDb, type Db } from "./storage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function respond<T>(fn: () => T, ms = 150 + Math.random() * 200): Promise<T> {
  await sleep(ms);
  return structuredClone(fn());
}
const nowIso = () => new Date().toISOString();
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

export const GENERATE_STEPS = [
  "Collecting deal data",
  "Reading diligence blocks and findings",
  "Checking against fund policy",
  "Drafting sections",
  "Formatting the memo",
];

export const revisionOf = (db: Db, dealId: string) =>
  db.activity.filter(
    (a) => a.dealId === dealId && a.type !== "memo_generated" && a.type !== "memo_approved",
  ).length;

export const memosApi = {
  bundle: (dealId: string) =>
    respond(() => {
      const db = readDb();
      const deal = db.deals.find((d) => d.id === dealId);
      if (!deal) return null;
      return {
        deal,
        cycle: db.cycles.find((c) => c.id === deal.cycleId),
        memos: db.memos.filter((m) => m.dealId === dealId).sort((a, b) => b.version - a.version),
        revision: revisionOf(db, dealId),
        inputs: {
          documents: db.documents.filter((d) => d.dealId === dealId).length,
          openFindings: db.findings.filter(
            (f) => f.dealId === dealId && (f.status === "open" || f.status === "under_review"),
          ).length,
          pendingSuggestions: db.adjustments.filter(
            (a) => a.dealId === dealId && a.status === "proposed",
          ).length,
          readiness: deal.diligenceReadiness,
        },
      };
    }),

  /** Mock AI generation: the pauses are theatre, the content is derived from the live deal data. */
  async generate(args: {
    dealId: string;
    type: TMemoType;
    actorId: string;
    onStep?: (i: number) => void;
  }): Promise<ICMemo> {
    const { dealId, type, actorId, onStep } = args;
    for (let i = 0; i < GENERATE_STEPS.length; i++) {
      onStep?.(i);
      await sleep(i === 3 ? 900 : 450);
    }
    const db = readDb();
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Deal not found");

    const sections = generateSections({
      deal,
      type,
      cycle: db.cycles.find((c) => c.id === deal.cycleId),
      owner: db.users.find((u) => u.id === deal.ownerId),
      securities: db.securities.filter((s) => s.dealId === dealId),
      blocks: db.diligenceBlocks.filter((b) => b.dealId === dealId),
      documents: db.documents.filter((d) => d.dealId === dealId),
      findings: db.findings.filter((f) => f.dealId === dealId),
      adjustments: db.adjustments.filter((a) => a.dealId === dealId),
    });

    const existing = db.memos.filter((m) => m.dealId === dealId);
    const version = Math.max(0, ...existing.map((m) => m.version)) + 1;

    existing
      .filter((m) => m.type === type && m.status !== "approved" && m.status !== "superseded")
      .forEach((m) => {
        m.status = "superseded";
      });

    const now = nowIso();
    const memo: ICMemo = {
      id: newId("memo"),
      dealId,
      type,
      status: "draft",
      version,
      title: memoTitle(deal, type),
      sections,
      generatedAt: now,
      generatedBy: actorId,
      sourceRevision: revisionOf(db, dealId),
      createdAt: now,
      createdBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    };
    db.memos.push(memo);
    db.activity.push({
      id: newId("act"),
      dealId,
      actorId,
      type: "memo_generated",
      timestamp: now,
      summary: `Generated ${MEMO_TYPE_LABEL[type].toLowerCase()} IC memo v${version}`,
      entityType: "memo",
      entityId: memo.id,
      metadata: { version, type, sourceRevision: memo.sourceRevision },
    });
    writeDb(db);
    onStep?.(GENERATE_STEPS.length);
    return structuredClone(memo);
  },

  updateSection: (memoId: string, sectionId: string, content: string, actorId: string) =>
    respond(() => {
      const db = readDb();
      const memo = db.memos.find((m) => m.id === memoId);
      if (!memo) throw new Error("Memo not found");
      if (!isEditable(memo.status))
        throw new Error("This version is locked. Send it back to draft or review to edit.");
      const s = memo.sections.find((x) => x.id === sectionId);
      if (!s) throw new Error("Section not found");
      s.content = content;
      Object.assign(memo, { updatedAt: nowIso(), updatedBy: actorId });
      writeDb(db);
      return memo;
    }, 250),

  setStatus: (memoId: string, to: TMemoStatus, actorId: string) =>
    respond(() => {
      const db = readDb();
      const memo = db.memos.find((m) => m.id === memoId);
      if (!memo) throw new Error("Memo not found");
      if (!MEMO_TRANSITIONS[memo.status]?.some((t) => t.to === to))
        throw new Error(`Cannot move a ${memo.status} memo to ${to}.`);
      const now = nowIso();
      memo.status = to;
      Object.assign(memo, { updatedAt: now, updatedBy: actorId });
      if (to === "approved") {
        Object.assign(memo, { approvedBy: actorId, approvedAt: now });
        db.activity.push({
          id: newId("act"),
          dealId: memo.dealId,
          actorId,
          type: "memo_approved",
          timestamp: now,
          summary: `Approved IC memo v${memo.version}`,
          entityType: "memo",
          entityId: memo.id,
        });
      }
      writeDb(db);
      return memo;
    }, 300),
};
