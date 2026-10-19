import type { Adjustment } from "../types/adjustments";
import type { Cycle } from "../types/cycles";
import type { Deal } from "../types/deals";
import type { DiligenceBlock, FinancialMetrics } from "../types/diligence";
import type { DealDocument } from "../types/documents";
import type { Finding } from "../types/findings";
import type { MemoSection, TMemoType } from "../types/memos";
import type { Security } from "../types/securities";
import type { User } from "../types/users";
import { DEAL_TYPE_LABELS, FUND_POLICY, READINESS_META, humanize } from "../lib/deal-meta";
import { formatDate, formatMoney } from "../lib/format";

export interface MemoInput {
  deal: Deal;
  cycle?: Cycle;
  owner?: User;
  securities: Security[];
  blocks: DiligenceBlock[];
  documents: DealDocument[];
  findings: Finding[];
  adjustments: Adjustment[];
  type: TMemoType;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const p = (s: string) => `<p>${s}</p>`;
const b = (s: string) => `<strong>${esc(s)}</strong>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li><p>${i}</p></li>`).join("")}</ul>`;
const table = (header: string[], rows: string[][]) =>
  `<table><tbody><tr>${header.map((h) => `<th><p>${esc(h)}</p></th>`).join("")}</tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join("")}</tr>`).join("") +
  `</tbody></table>`;

export const memoTitle = (deal: Deal, type: TMemoType) =>
  `${deal.name}: ${type === "preliminary" ? "Preliminary" : type === "final" ? "Final" : "Full"} Investment Committee Memo`;

const fin = (blocks: DiligenceBlock[]) => blocks.find((x) => x.type === "financial_analysis");
const mgmt = (blocks: DiligenceBlock[]) => blocks.find((x) => x.type === "management_reporting");
const metricsOf = (blk?: DiligenceBlock): FinancialMetrics | undefined =>
  blk && (blk.type === "financial_analysis" || blk.type === "management_reporting")
    ? blk.content.metrics
    : undefined;

const breaches = (m?: FinancialMetrics) => ({
  npl: (m?.nplRatio ?? 0) > FUND_POLICY.maxNplRatio,
  lev: (m?.leverage ?? 0) > FUND_POLICY.maxLeverage,
});

const isOpen = (f: Finding) => f.status === "open" || f.status === "under_review";

interface Recommendation {
  label: string;
  text: string;
}

function recommend(
  i: MemoInput,
  m: FinancialMetrics | undefined,
  pending?: Adjustment,
): Recommendation {
  const open = i.findings.filter(isOpen);
  const br = breaches(m);
  if (!m || (m.leverage === undefined && m.nplRatio === undefined)) {
    return {
      label: "Defer",
      text: "Financial analysis is not yet complete, so no credit recommendation can be made.",
    };
  }
  if (br.npl || br.lev) {
    const which = [
      br.lev
        ? `leverage of ${m.leverage}x exceeds the ${FUND_POLICY.maxLeverage.toFixed(1)}x policy limit`
        : "",
      br.npl
        ? `the NPL ratio of ${m.nplRatio}% exceeds the ${FUND_POLICY.maxNplRatio}% fund limit`
        : "",
    ]
      .filter(Boolean)
      .join(" and ");
    return {
      label: "Do not approve in current form",
      text:
        `On the reported figures ${which}.` +
        (pending
          ? " An AI-suggested adjustment based on the management report is pending review and, if accepted, would change this assessment."
          : " The team should obtain supplementary management information before resubmitting."),
    };
  }
  if (
    open.length > 0 ||
    i.deal.riskLevel === "elevated" ||
    i.deal.riskLevel === "high" ||
    i.deal.diligenceReadiness < 100
  ) {
    return {
      label: "Approve with conditions",
      text: "Credit metrics are within fund policy, but open items remain and are proposed as conditions to approval and funding.",
    };
  }
  return {
    label: "Approve",
    text: "Credit metrics are within fund policy and no material open items remain.",
  };
}

export function generateSections(i: MemoInput): MemoSection[] {
  const { deal, type } = i;
  const cur = i.deal.requestedAmount?.currency ?? "USD";
  const finBlock = fin(i.blocks);
  const mgmtBlock = mgmt(i.blocks);
  const m = metricsOf(finBlock);
  const accepted = i.adjustments.filter((a) => a.status === "accepted").at(-1);
  const pending = i.adjustments.filter((a) => a.status === "proposed").at(-1);
  const declined = i.adjustments.filter((a) => a.status === "rejected").at(-1);
  const open = i.findings.filter(isOpen);
  const rec = recommend(i, m, pending);
  const docIdsOf = (...blks: (DiligenceBlock | undefined)[]) =>
    blks.flatMap((x) => x?.documentIds ?? []);
  const sections: MemoSection[] = [];
  const add = (
    id: string,
    title: string,
    content: string,
    sourceDocumentIds: string[] = [],
    relatedFindingIds: string[] = [],
  ) =>
    sections.push({
      id,
      title,
      content,
      sourceDocumentIds: [...new Set(sourceDocumentIds)],
      relatedFindingIds,
    });

  // 1. Executive summary
  const summaryBits = [
    `${b(deal.borrowerName)} (${esc(deal.industry ?? "industry n/a")}, ${esc(deal.location ?? "location n/a")}) has requested ${b(formatMoney(deal.requestedAmount, false))}` +
      (deal.dealType
        ? ` in the form of a ${esc(DEAL_TYPE_LABELS[deal.dealType].toLowerCase())} facility`
        : "") +
      (deal.proposedAmount
        ? `. The deal team proposes a commitment of ${b(formatMoney(deal.proposedAmount, false))}.`
        : "."),
  ];
  if (m) {
    summaryBits.push(
      `On ${accepted ? "adjusted" : "reported"} figures the borrower shows revenue of ${formatMoney(m.revenue)}, EBITDA of ${formatMoney(m.ebitda)}, ` +
        `total debt of ${formatMoney(m.totalDebt)} (${m.leverage ?? "n/a"}x leverage) and an NPL ratio of ${m.nplRatio ?? "n/a"}%.`,
    );
  }
  add(
    "summary",
    "Executive summary",
    summaryBits.map(p).join("") + p(`${b("Recommendation: " + rec.label + ".")} ${esc(rec.text)}`),
    docIdsOf(finBlock, mgmtBlock),
    open.map((f) => f.id),
  );

  // 2. Transaction overview
  add(
    "overview",
    "Transaction overview",
    table(
      ["Item", "Detail"],
      [
        ["Borrower", esc(deal.borrowerName)],
        ["Deal", esc(deal.name)],
        ["Facility type", deal.dealType ? esc(DEAL_TYPE_LABELS[deal.dealType]) : "—"],
        ["Requested amount", esc(formatMoney(deal.requestedAmount, false))],
        ["Proposed amount", esc(formatMoney(deal.proposedAmount, false))],
        ["Industry / location", `${esc(deal.industry ?? "—")} / ${esc(deal.location ?? "—")}`],
        ["Target close", esc(formatDate(deal.targetCloseDate))],
        [
          "IC cycle",
          i.cycle
            ? `${esc(i.cycle.name)} (IC ${esc(formatDate(deal.nextIcDate))})`
            : esc(formatDate(deal.nextIcDate)),
        ],
        ["Deal owner", esc(i.owner?.name ?? "—")],
      ],
    ),
  );

  // Business overview (full / final)
  if (type !== "preliminary") {
    add(
      "business",
      "Business overview",
      p(
        esc(
          deal.description ??
            `${deal.borrowerName} operates in the ${deal.industry ?? "target"} sector${deal.location ? ` in ${deal.location}` : ""}. A detailed business description will be added once the business overview diligence block is complete.`,
        ),
      ),
    );
  }

  // 3. Securities
  add(
    "securities",
    "Proposed securities",
    i.securities.length === 0
      ? p("No securities have been structured yet.")
      : table(
          ["Security", "Seniority", "Commitment", "Pricing", "Maturity"],
          i.securities.map((s) => [
            esc(s.name),
            esc(humanize(s.seniority)),
            esc(formatMoney(s.commitmentAmount, false)),
            s.interestRate?.benchmark
              ? `${esc(s.interestRate.benchmark)} + ${s.interestRate.spreadBps ?? "—"} bps${s.interestRate.floorBps !== undefined ? `, ${(s.interestRate.floorBps / 100).toFixed(2)}% floor` : ""}`
              : "—",
            esc(formatDate(s.maturityDate)),
          ]),
        ),
  );

  // 4. Financial analysis
  const flag = (breach: boolean) => (breach ? b("Breach") : "Within policy");
  const metricRows = (x: FinancialMetrics, before?: FinancialMetrics): string[][] => {
    const row = (label: string, v: string, pre: string | undefined, policy: string) =>
      before ? [esc(label), esc(pre ?? "—"), esc(v), policy] : [esc(label), esc(v), policy];
    const bx = breaches(x);
    const money = (k: "revenue" | "ebitda" | "totalDebt" | "cash" | "netDebt") => formatMoney(x[k]);
    const pre = (k: "revenue" | "ebitda" | "totalDebt" | "cash" | "netDebt") =>
      before ? formatMoney(before[k]) : undefined;
    return [
      row("Revenue (LTM)", money("revenue"), pre("revenue"), "—"),
      row("EBITDA (LTM)", money("ebitda"), pre("ebitda"), "—"),
      row("Total debt", money("totalDebt"), pre("totalDebt"), "—"),
      row("Cash", money("cash"), pre("cash"), "—"),
      row("Net debt", money("netDebt"), pre("netDebt"), "—"),
      row(
        "Leverage (debt / EBITDA)",
        x.leverage !== undefined ? `${x.leverage}x` : "—",
        before?.leverage !== undefined ? `${before.leverage}x` : undefined,
        `${flag(bx.lev)} (max ${FUND_POLICY.maxLeverage.toFixed(1)}x)`,
      ),
      row(
        "NPL ratio",
        x.nplRatio !== undefined ? `${x.nplRatio}%` : "—",
        before?.nplRatio !== undefined ? `${before.nplRatio}%` : undefined,
        `${flag(bx.npl)} (max ${FUND_POLICY.maxNplRatio}%)`,
      ),
    ];
  };
  let finHtml: string;
  if (!m || Object.keys(m).length === 0) {
    finHtml = p(
      "Financial reporting has not been analysed yet. Upload the financing report to populate this section.",
    );
  } else if (accepted) {
    finHtml =
      p(
        `Figures below are the ${b("adjusted")} position after the reviewed reclassification, shown next to the figures originally reported in the financing report (${esc(finBlock?.type === "financial_analysis" ? (finBlock.content.reportingPeriod ?? "") : "")}).`,
      ) +
      table(["Metric", "As reported", "Adjusted", "Policy test"], metricRows(m, accepted.before)) +
      p(`${b("Adjustment accepted: ")}${esc(accepted.title)}. ${esc(accepted.rationale)}`);
  } else {
    finHtml =
      table(["Metric", "Value", "Policy test"], metricRows(m)) +
      (pending
        ? p(
            `${b("Pending review: ")}an AI-suggested adjustment (“${esc(pending.title)}”) is awaiting a decision and is not reflected above.`,
          )
        : "") +
      (declined
        ? p(
            `${b("Declined adjustment: ")}“${esc(declined.title)}” was reviewed and declined${declined.decisionComment ? ` (“${esc(declined.decisionComment)}”)` : ""}; reported figures are used.`,
          )
        : "");
  }
  add("financials", "Financial analysis", finHtml, docIdsOf(finBlock), finBlock?.findingIds ?? []);

  // 5. Management reporting (full / final)
  if (type !== "preliminary") {
    const mm = mgmtBlock && mgmtBlock.type === "management_reporting" ? mgmtBlock : undefined;
    let html: string;
    if (!mm || mm.content.reconciliationStatus === "not_started") {
      html = p(
        "No management report has been received yet. The financing report has not been reconciled to management accounts.",
      );
    } else {
      const mmm = mm.content.metrics;
      html =
        p(`Reconciliation status: ${b(humanize(mm.content.reconciliationStatus))}.`) +
        (mmm.totalDebt
          ? ul(
              [
                `Management accounts show financial debt of ${esc(formatMoney(mmm.totalDebt))}${mmm.leverage !== undefined ? ` (${mmm.leverage}x EBITDA)` : ""}.`,
                mmm.nplRatio !== undefined ? `Management-basis NPL ratio is ${mmm.nplRatio}%.` : "",
              ].filter(Boolean),
            )
          : "") +
        (mm.content.commentary
          ? mm.content.commentary
              .split(/\n+/)
              .map((t) => p(esc(t)))
              .join("")
          : "");
    }
    add(
      "management",
      "Management reporting and reconciliation",
      html,
      docIdsOf(mgmtBlock),
      mgmtBlock?.findingIds ?? [],
    );
  }

  // 6. Risks
  add(
    "risks",
    "Key risks and findings",
    i.findings.length === 0
      ? p("No findings have been recorded.")
      : table(
          ["Finding", "Severity", "Source", "Status"],
          i.findings.map((f) => [
            `${b(f.title)}<br>${esc(f.description)}`,
            esc(humanize(f.severity)),
            esc(humanize(f.source)),
            esc(humanize(f.status)),
          ]),
        ),
    i.findings.flatMap((f) => f.sourceDocumentIds),
    i.findings.map((f) => f.id),
  );

  // 7. Mitigants and conditions (full / final)
  if (type !== "preliminary") {
    const conds = [
      ...open.map((f) => `Resolve open finding: ${esc(f.title)}.`),
      mgmtBlock &&
      mgmtBlock.type === "management_reporting" &&
      mgmtBlock.content.reconciliationStatus !== "reconciled"
        ? "Complete reconciliation of the financing report to management accounts."
        : "",
      pending ? "Obtain a decision on the pending AI-suggested adjustment before IC." : "",
      `Financial covenants set with at least 20% headroom to the base case; leverage covenant not above ${FUND_POLICY.maxLeverage.toFixed(1)}x at closing.`,
      "Customary security package, including a first-ranking share pledge and all-asset security, delivered as conditions precedent.",
    ].filter(Boolean);
    add(
      "mitigants",
      "Mitigants and proposed conditions",
      p("The deal team proposes the following conditions to approval and funding:") + ul(conds),
    );
  }

  // 8. Recommendation
  add(
    "recommendation",
    type === "preliminary" ? "Preliminary view and next steps" : "Recommendation",
    p(`${b(rec.label + ".")} ${esc(rec.text)}`) +
      (type === "preliminary"
        ? ul([
            "Complete outstanding diligence blocks.",
            "Request any missing management information.",
            "Re-run this memo as a full version once the open findings are resolved.",
          ])
        : ""),
    [],
    open.map((f) => f.id),
  );

  // 9. Diligence status and sources (full / final)
  if (type !== "preliminary") {
    add(
      "dd-status",
      "Due diligence status",
      table(
        ["Block", "Status", "Documents", "Findings"],
        i.blocks.map((x) => [
          esc(x.title),
          esc(READINESS_META[x.readiness].label),
          String(x.documentIds.length),
          String(x.findingIds.length),
        ]),
      ) + p(`Overall diligence readiness: ${b(deal.diligenceReadiness + "%")}.`),
    );
    add(
      "sources",
      "Source documents",
      i.documents.length === 0
        ? p("No documents on file.")
        : ul(
            i.documents.map(
              (d) =>
                `${esc(d.name)} (${esc(humanize(d.type))}, ${esc(humanize(d.processingStatus))})`,
            ),
          ),
      i.documents.map((d) => d.id),
    );
  }

  // 10. Decision block (final only)
  if (type === "final") {
    add(
      "decision",
      "IC decision",
      table(
        ["Item", "Entry"],
        [
          ["Decision", "Approved / Approved with conditions / Declined"],
          ["Approved amount", `${esc(cur)} ____________`],
          ["Conditions", "See “Mitigants and proposed conditions”"],
          ["Date", "____________"],
          ["IC members present", "____________"],
        ],
      ),
    );
  }

  return sections;
}
