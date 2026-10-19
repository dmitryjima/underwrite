import type { Adjustment } from "../types/adjustments";
import type { TRiskLevel } from "../types/common";
import type { Deal } from "../types/deals";
import type { DiligenceBlock, FinancialMetrics } from "../types/diligence";
import type { Finding } from "../types/findings";
import type { Security } from "../types/securities";
import { FUND_POLICY } from "./deal-meta";
import { historyBundle } from "./history";

export interface RiskRow {
  id: string;
  category: string;
  risk: string;
  detail: string;
  mitigant: string;
  inherent: TRiskLevel;
  residual: TRiskLevel;
  basedOn: string[];
}

export interface RiskInput {
  deal: Deal;
  securities: Security[];
  blocks: DiligenceBlock[];
  findings: Finding[];
  adjustments: Adjustment[];
}

const ORDER: TRiskLevel[] = ["low", "moderate", "elevated", "high", "critical"];
export const riskScore = (l: TRiskLevel) => (l === "unknown" ? 0 : ORDER.indexOf(l) + 1);
const lvl = (s: number): TRiskLevel => (s <= 0 ? "unknown" : ORDER[Math.min(5, s) - 1]);
const down = (l: TRiskLevel, n = 1): TRiskLevel =>
  riskScore(l) === 0 ? l : lvl(Math.max(1, riskScore(l) - n));

const levLevel = (x: number): TRiskLevel =>
  x > FUND_POLICY.maxLeverage * 1.25
    ? "high"
    : x > FUND_POLICY.maxLeverage
      ? "elevated"
      : x <= 3
        ? "low"
        : "moderate";
const nplLevel = (x: number): TRiskLevel =>
  x > FUND_POLICY.maxNplRatio * 1.5
    ? "high"
    : x > FUND_POLICY.maxNplRatio
      ? "elevated"
      : x <= 2
        ? "low"
        : "moderate";

const SENIORITY_SCORE: Record<string, number> = {
  super_senior: 1,
  senior_secured: 1,
  unitranche: 2,
  second_lien: 3,
  subordinated: 4,
  unsecured: 4,
};
const label = (s: string) => s.replace(/_/g, " ");

export function deriveRiskOverview(i: RiskInput): RiskRow[] {
  const rows: RiskRow[] = [];
  const fin = i.blocks.find((b) => b.type === "financial_analysis");
  const mgmt = i.blocks.find((b) => b.type === "management_reporting");
  const cur: FinancialMetrics | undefined =
    fin && fin.type === "financial_analysis" ? fin.content.metrics : undefined;
  const accepted = i.adjustments.filter((a) => a.status === "accepted").at(-1);
  const pending = i.adjustments.filter((a) => a.status === "proposed").at(-1);
  const reported = accepted?.before ?? cur; // what the borrower's own report says
  const covenant = i.securities.map((s) => s.covenantSummary).find(Boolean);
  const protectedStructure = i.securities.some(
    (s) => (SENIORITY_SCORE[s.seniority] ?? 9) <= 2 && s.collateralDescription && s.covenantSummary,
  );
  const linkedFindingIds = new Set(i.adjustments.flatMap((a) => a.findingIds));

  const metricRow = (
    key: "leverage" | "nplRatio",
    category: string,
    risk: string,
    unit: string,
    fmt: (n: number) => string,
    levelOf: (n: number) => TRiskLevel,
    limit: number,
    breachCondition: string,
  ) => {
    const now = cur?.[key];
    const was = reported?.[key];
    if (now === undefined || was === undefined) return;
    const inherent = levelOf(was);
    let residual = levelOf(now);
    const breaching = now > limit;
    let mitigant: string;
    if (accepted && now !== was) {
      mitigant = `Restated after accepted adjustment “${accepted.title}”: ${fmt(was)}${unit} → ${fmt(now)}${unit}, within the ${fmt(limit)}${unit} policy limit.`;
    } else if (pending && pending.after[key] !== undefined && pending.after[key] !== was) {
      mitigant = `AI-suggested adjustment pending review would restate this to ${fmt(pending.after[key]!)}${unit}. Not yet reflected: decide the suggestion and reconcile with management accounts before IC.`;
    } else if (breaching) {
      mitigant = `None in place. ${breachCondition}`;
    } else {
      mitigant = covenant
        ? `Covenant package: ${covenant}`
        : "Financial covenants with at least 20% headroom proposed.";
    }
    if (!breaching && riskScore(residual) >= 2 && protectedStructure) {
      residual = down(residual);
      mitigant += " Senior secured position with collateral and covenants gives further comfort.";
    }
    const sources = ["Financial analysis"];
    if (accepted || pending) sources.push("AI adjustment");
    rows.push({
      id: key,
      category,
      risk,
      detail: `${fmt(now)}${unit} against a policy limit of ${fmt(limit)}${unit}${was !== now ? ` (as reported: ${fmt(was)}${unit})` : ""}.`,
      mitigant,
      inherent,
      residual,
      basedOn: sources,
    });
  };
  metricRow(
    "leverage",
    "Leverage",
    "Excess leverage",
    "x",
    (n) => n.toFixed(1),
    levLevel,
    FUND_POLICY.maxLeverage,
    `Condition precedent: leverage covenant at or below ${FUND_POLICY.maxLeverage.toFixed(1)}x at closing, with a deleveraging plan.`,
  );
  metricRow(
    "nplRatio",
    "Asset quality",
    "High non-performing loan ratio",
    "%",
    (n) => n.toFixed(1),
    nplLevel,
    FUND_POLICY.maxNplRatio,
    "Require an NPL cure plan and a reporting covenant on overdue balances.",
  );

  const hist = historyBundle(i.deal, i.blocks).financial;
  if (hist.length >= 4) {
    const first = hist[0].m,
      last = hist.at(-1)!.m;
    const levRise = (reportedLast(last.leverage, reported?.leverage) ?? 0) - (first.leverage ?? 0);
    const nplRise = (reportedLast(last.nplRatio, reported?.nplRatio) ?? 0) - (first.nplRatio ?? 0);
    if (levRise >= 1.5 || nplRise >= 1.5) {
      const parts = [
        levRise >= 1.5
          ? `leverage ${first.leverage?.toFixed(1)}x → ${reported?.leverage?.toFixed(1)}x`
          : "",
        nplRise >= 1.5
          ? `NPL ${first.nplRatio?.toFixed(1)}% → ${reported?.nplRatio?.toFixed(1)}%`
          : "",
      ]
        .filter(Boolean)
        .join(", ");
      const inherent: TRiskLevel = levRise >= 3 || nplRise >= 3 ? "high" : "elevated";
      rows.push({
        id: "trend",
        category: "Credit trend",
        risk: "Deteriorating credit metrics over five years",
        detail: `On reported figures: ${parts} (${hist[0].period} to now).`,
        mitigant: accepted
          ? "Management accounts show a stable profile on a like-for-like basis (see 5-year view); quarterly reporting covenant to confirm the trend."
          : "Quarterly leverage and NPL reporting covenant; obtain management explanation of the drivers before IC.",
        inherent,
        residual: accepted ? down(inherent) : inherent,
        basedOn: ["Historical financials", ...(accepted ? ["Management accounts"] : [])],
      });
    }
  }

  if (mgmt && mgmt.type === "management_reporting") {
    const st = mgmt.content.reconciliationStatus;
    const map: Record<typeof st, { inherent: TRiskLevel; text: string }> = {
      not_started: {
        inherent: "moderate",
        text: "Upload and reconcile a management report against the financing report.",
      },
      in_progress: { inherent: "moderate", text: "Complete the reconciliation in progress." },
      discrepancy_found: {
        inherent: "high",
        text: "Resolve the discrepancy or accept the supported adjustment.",
      },
      reconciled: { inherent: "low", text: "Financing report reconciled to management accounts." },
    };
    const inherent = map[st].inherent;
    let residual = inherent;
    let mitigant = map[st].text;
    if (st === "discrepancy_found" || st === "in_progress") {
      if (accepted) {
        residual = "low";
        mitigant = `Discrepancy explained and resolved through the accepted adjustment “${accepted.title}”; supported by management accounts.`;
      } else if (pending)
        mitigant = `${mitigant} An AI-suggested adjustment is awaiting a decision.`;
    }
    rows.push({
      id: "reconciliation",
      category: "Data reliability",
      risk:
        st === "reconciled"
          ? "Reported figures reconcile to management accounts"
          : "Reliability of reported figures",
      detail: `Reconciliation status: ${label(st)}.`,
      mitigant,
      inherent,
      residual,
      basedOn: ["Management reporting", "Financing report"],
    });
  }

  if (cur?.cash && cur.totalDebt && cur.totalDebt.amount > 0) {
    const pct = (cur.cash.amount / cur.totalDebt.amount) * 100;
    const inherent: TRiskLevel = pct < 5 ? "elevated" : pct < 12 ? "moderate" : "low";
    rows.push({
      id: "liquidity",
      category: "Liquidity",
      risk: "Thin cash buffer relative to debt",
      detail: `Cash covers ${pct.toFixed(1)}% of total debt.`,
      mitigant:
        inherent === "low"
          ? "Adequate cash buffer."
          : "Minimum liquidity covenant and a cash-sweep on excess cash flow.",
      inherent,
      residual: inherent === "low" ? inherent : down(inherent),
      basedOn: ["Financial analysis"],
    });
  }

  if (i.securities.length === 0) {
    rows.push({
      id: "structure",
      category: "Structure",
      risk: "No security terms defined",
      detail: "No proposed securities are recorded for this deal.",
      mitigant: "Define seniority, collateral and covenants before IC.",
      inherent: "elevated",
      residual: "elevated",
      basedOn: ["Securities"],
    });
  } else {
    const worst = i.securities.reduce((a, s) =>
      (SENIORITY_SCORE[s.seniority] ?? 3) > (SENIORITY_SCORE[a.seniority] ?? 3) ? s : a,
    );
    const inherent = lvl(Math.min(5, SENIORITY_SCORE[worst.seniority] ?? 3));
    const collateral = i.securities.some((s) => s.collateralDescription);
    const covs = i.securities.some((s) => s.covenantSummary);
    const mitig =
      [
        collateral ? "Collateral package in place" : "Collateral not yet described",
        covs ? "financial covenants proposed" : "covenants not yet proposed",
      ].join("; ") + ".";
    rows.push({
      id: "structure",
      category: "Structure",
      risk: `Ranking: ${label(worst.seniority)}`,
      detail: `${i.securities.length} proposed instrument${i.securities.length > 1 ? "s" : ""}; lowest ranking is ${label(worst.seniority)}.`,
      mitigant: mitig,
      inherent,
      residual: collateral && covs ? down(inherent) : inherent,
      basedOn: ["Securities"],
    });
  }

  for (const f of i.findings) {
    // findings about leverage / NPL, or tied to an AI adjustment, are already covered by the policy rows above
    const covered =
      linkedFindingIds.has(f.id) ||
      !!f.suggestedAdjustmentId ||
      (/leverage/i.test(f.title) && rows.some((r) => r.id === "leverage")) ||
      (/\bnpl\b|non-?performing/i.test(f.title) && rows.some((r) => r.id === "nplRatio"));
    if (covered || f.status === "rejected") continue;
    const inherent: TRiskLevel = f.severity === "unknown" ? "moderate" : f.severity;
    const resolved = f.status === "resolved";
    const acceptedRisk = f.status === "accepted";
    rows.push({
      id: `finding-${f.id}`,
      category: "Finding",
      risk: f.title,
      detail: f.description,
      mitigant: resolved
        ? (f.reviewerComment ?? "Resolved by the deal team.")
        : acceptedRisk
          ? (f.reviewerComment ?? "Risk accepted by the reviewer.")
          : `${f.status === "under_review" ? "Under review" : "Open"}: resolve before IC.`,
      inherent,
      residual: resolved ? "low" : acceptedRisk ? down(inherent) : inherent,
      basedOn: ["Findings", ...(f.source === "ai_analysis" ? ["AI analysis"] : [])],
    });
  }

  const r = i.deal.diligenceReadiness;
  const inherent: TRiskLevel = r < 60 ? "elevated" : r < 85 ? "moderate" : "low";
  const gaps = i.blocks
    .filter((b) => b.readiness === "not_started" || b.readiness === "in_progress")
    .map((b) => b.title);
  if (inherent !== "low") {
    rows.push({
      id: "diligence",
      category: "Diligence",
      risk: "Incomplete due diligence",
      detail: `Readiness is ${r}%${gaps.length ? `; outstanding: ${gaps.slice(0, 3).join(", ")}${gaps.length > 3 ? ` and ${gaps.length - 3} more` : ""}` : ""}.`,
      mitigant:
        "Complete the open blocks before IC; remaining items become conditions precedent to funding.",
      inherent,
      residual: inherent,
      basedOn: ["Diligence blocks"],
    });
  }

  return rows.sort(
    (a, b) =>
      riskScore(b.residual) - riskScore(a.residual) ||
      riskScore(b.inherent) - riskScore(a.inherent),
  );
}

function reportedLast(a?: number, b?: number) {
  return b ?? a;
}
