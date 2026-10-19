import type { ActivityEvent } from "../types/activity";
import type { AuditMetadata, Money, TReadiness } from "../types/common";
import type { Cycle } from "../types/cycles";
import type { Deal } from "../types/deals";
import type { DealDocument } from "../types/documents";
import {
  DILIGENCE_BLOCK_TYPES,
  type DiligenceBlock,
  type DiligenceBlockBase,
  type FinancialMetrics,
  type TDiligenceBlockType,
} from "../types/diligence";
import type { Finding } from "../types/findings";
import type { Security } from "../types/securities";
import { PERMISSION_AREAS, type Permission, type Role, type User } from "../types/users";
import type { Db } from "../api/storage";

const usd = (m: number): Money => ({ amount: Math.round(m * 1_000_000), currency: "USD" });
const audit = (by: string, at: string): AuditMetadata => ({
  createdAt: at,
  createdBy: by,
  updatedAt: at,
  updatedBy: by,
});

const U = {
  analyst: "u-maria",
  lead: "u-daniel",
  partner: "u-elena",
  ivan: "u-ivan",
  sofia: "u-sofia",
};

const perms = (read: string[], write: string[]): Permission[] => [
  ...PERMISSION_AREAS.filter((a) => read.includes(a)).map((area) => ({
    area,
    accessLevel: "read" as const,
  })),
  ...PERMISSION_AREAS.filter((a) => write.includes(a)).map((area) => ({
    area,
    accessLevel: "write" as const,
  })),
];

export const roles: Role[] = [
  {
    id: "role-analyst",
    name: "Analyst",
    permissions: perms(
      ["deals_dashboard", "deal_details", "deal_securities", "deal_ic_memo_preliminary"],
      ["deal_due_diligence", "deal_documents", "deal_findings"],
    ),
  },
  {
    id: "role-lead",
    name: "Deal Lead",
    permissions: perms(
      ["deal_ic_memo_final", "team_management"],
      [
        "deals_dashboard",
        "deal_details",
        "deal_securities",
        "deal_due_diligence",
        "deal_documents",
        "deal_findings",
        "deal_ic_memo_preliminary",
      ],
    ),
  },
  {
    id: "role-partner",
    name: "IC Partner",
    permissions: perms([], [...PERMISSION_AREAS]),
  },
];

export const roleBlurbs: Record<string, string> = {
  "role-analyst":
    "Works the diligence blocks, uploads documents and raises findings. Read-only on deal terms and final memo.",
  "role-lead":
    "Owns deals end to end: terms, securities, diligence and preliminary memos. Can add deals.",
  "role-partner": "Full access including final IC memos, team management and settings.",
};

export const users: User[] = [
  {
    id: U.analyst,
    name: "Maria Lopez",
    email: "maria.lopez@fund.example",
    roleId: "role-analyst",
    teamIds: ["team-a"],
  },
  {
    id: U.lead,
    name: "Daniel Brooks",
    email: "daniel.brooks@fund.example",
    roleId: "role-lead",
    teamIds: ["team-a"],
  },
  {
    id: U.partner,
    name: "Elena Johnson",
    email: "elena.Johnson@fund.example",
    roleId: "role-partner",
    teamIds: ["team-a", "team-b"],
  },
  {
    id: U.ivan,
    name: "Ivan Moreau",
    email: "ivan.moreau@fund.example",
    roleId: "role-analyst",
    teamIds: ["team-a"],
  },
  {
    id: U.sofia,
    name: "Sofia Reyes",
    email: "sofia.reyes@fund.example",
    roleId: "role-lead",
    teamIds: ["team-b"],
  },
];

export const DEMO_LOGIN_USER_IDS = [U.analyst, U.lead, U.partner];

const C0 = "cyc-2026-09";
const C1 = "cyc-2026-10-1";
const C2 = "cyc-2026-10-2";

export const cycles: Cycle[] = [
  {
    id: C0,
    name: "II Cycle Sep 2026",
    startDate: "2026-09-14",
    endDate: "2026-10-04",
    status: "archived",
    description: "IC held Oct 1",
  },
  {
    id: C1,
    name: "I Cycle Oct 2026",
    startDate: "2026-10-05",
    endDate: "2026-10-25",
    status: "active",
    description: "IC on Thu Oct 22, 10:00",
  },
  {
    id: C2,
    name: "II Cycle Oct 2026",
    startDate: "2026-10-26",
    endDate: "2026-11-15",
    status: "active",
    description: "IC on Thu Nov 12, 15:00",
  },
];

type DealSeed = Pick<Deal, "id" | "name" | "borrowerName" | "workflow" | "ownerId" | "riskLevel"> &
  Partial<Omit<Deal, keyof AuditMetadata>> & {
    ddLevel: number; // number of completed blocks (-1 = nothing started)
    readinessOverride?: TReadiness[];
    createdAt: string;
    updatedAt?: string;
  };

const dealSeeds: DealSeed[] = [
  {
    id: "deal-northwind",
    name: "Project Northwind",
    borrowerName: "Northwind Logistics Group",
    description:
      "Senior secured facility to refinance existing bank debt and fund fleet expansion for a Central European 3PL.",
    workflow: { stage: "due_diligence", status: "in_progress" },
    cycleId: C1,
    ownerId: U.lead,
    teamMemberIds: [U.analyst, U.ivan],
    dealType: "senior_secured",
    requestedAmount: usd(45),
    proposedAmount: usd(40),
    industry: "Logistics & Supply Chain",
    location: "Kraków, Poland",
    targetCloseDate: "2026-12-15",
    nextIcDate: "2026-10-22",
    riskLevel: "high",
    tags: ["sponsor-backed", "cross-border"],
    ddLevel: 0,
    readinessOverride: [
      "needs_review",
      "not_started",
      "in_progress",
      "complete",
      "complete",
      "in_progress",
      "not_started",
    ],
    createdAt: "2026-10-06T09:00:00Z",
    updatedAt: "2026-10-16T14:20:00Z",
  },
  {
    id: "deal-atlas",
    name: "Project Atlas",
    borrowerName: "Atlas Dental Partners",
    workflow: { stage: "teaser_evaluation", status: "new" },
    cycleId: C2,
    ownerId: U.sofia,
    dealType: "unitranche",
    requestedAmount: usd(25),
    industry: "Healthcare Services",
    location: "NYC, USA",
    riskLevel: "unknown",
    ddLevel: -1,
    tags: ["buy-and-build"],
    createdAt: "2026-10-15T08:30:00Z",
  },
  {
    id: "deal-meridian",
    name: "Project Meridian",
    borrowerName: "Meridian Software Holdings",
    workflow: { stage: "teaser_evaluation", status: "screening_complete" },
    cycleId: C2,
    ownerId: U.lead,
    teamMemberIds: [U.ivan],
    dealType: "unitranche",
    requestedAmount: usd(60),
    industry: "Software",
    location: "London, UK",
    riskLevel: "moderate",
    ddLevel: -1,
    tags: ["recurring-revenue"],
    createdAt: "2026-10-09T11:00:00Z",
    updatedAt: "2026-10-14T10:00:00Z",
  },
  {
    id: "deal-falcon",
    name: "Project Falcon",
    borrowerName: "Falcon Aerospace Components",
    workflow: { stage: "due_diligence", status: "blocked" },
    cycleId: C1,
    ownerId: U.sofia,
    teamMemberIds: [U.analyst],
    dealType: "senior_secured",
    requestedAmount: usd(38),
    proposedAmount: usd(35),
    industry: "Aerospace & Defense",
    location: "Munich, Germany",
    targetCloseDate: "2026-12-20",
    nextIcDate: "2026-10-22",
    riskLevel: "elevated",
    ddLevel: 3,
    tags: ["customer-concentration"],
    createdAt: "2026-09-22T09:00:00Z",
    updatedAt: "2026-10-13T16:45:00Z",
  },
  {
    id: "deal-cedar",
    name: "Project Cedar",
    borrowerName: "Cedar Foods International",
    workflow: { stage: "ic_preparation", status: "drafting" },
    cycleId: C2,
    ownerId: U.lead,
    teamMemberIds: [U.ivan, U.analyst],
    dealType: "second_lien",
    requestedAmount: usd(30),
    proposedAmount: usd(30),
    industry: "Consumer Staples",
    location: "Barcelona, Spain",
    targetCloseDate: "2026-12-10",
    nextIcDate: "2026-11-12",
    riskLevel: "moderate",
    ddLevel: 6,
    tags: [],
    createdAt: "2026-09-18T09:00:00Z",
    updatedAt: "2026-10-15T09:10:00Z",
  },
  {
    id: "deal-helix",
    name: "Project Helix",
    borrowerName: "Helix Biologics Services",
    workflow: { stage: "ic_preparation", status: "ready_for_ic" },
    cycleId: C1,
    ownerId: U.lead,
    teamMemberIds: [U.analyst],
    dealType: "unitranche",
    requestedAmount: usd(52),
    proposedAmount: usd(50),
    industry: "Life Sciences",
    location: "San Francisco, USA",
    targetCloseDate: "2026-11-30",
    nextIcDate: "2026-10-22",
    riskLevel: "low",
    ddLevel: 7,
    tags: ["sponsor-backed"],
    createdAt: "2026-09-10T09:00:00Z",
    updatedAt: "2026-10-16T18:00:00Z",
  },
  {
    id: "deal-orion",
    name: "Project Orion",
    borrowerName: "Orion Energy Services",
    workflow: { stage: "ic_review", status: "scheduled" },
    cycleId: C1,
    ownerId: U.sofia,
    teamMemberIds: [U.ivan],
    dealType: "mezzanine",
    requestedAmount: usd(70),
    proposedAmount: usd(65),
    industry: "Energy Services",
    location: "Vancouver, Canada",
    targetCloseDate: "2026-11-25",
    nextIcDate: "2026-10-22",
    riskLevel: "moderate",
    ddLevel: 7,
    tags: ["cyclical"],
    createdAt: "2026-09-01T09:00:00Z",
    updatedAt: "2026-10-12T12:00:00Z",
  },
  {
    id: "deal-vega",
    name: "Project Vega",
    borrowerName: "Vega Hospitality Group",
    workflow: { stage: "ic_review", status: "decision_pending" },
    cycleId: C1,
    ownerId: U.lead,
    dealType: "asset_based",
    requestedAmount: usd(33),
    proposedAmount: usd(30),
    industry: "Hospitality",
    location: "Lyon, France",
    nextIcDate: "2026-10-22",
    riskLevel: "moderate",
    ddLevel: 7,
    tags: ["real-estate-backed"],
    createdAt: "2026-08-28T09:00:00Z",
    updatedAt: "2026-10-08T09:00:00Z",
  },
  {
    id: "deal-bluebird",
    name: "Project Bluebird",
    borrowerName: "Bluebird Marine Logistics",
    workflow: { stage: "approved", status: "approved_with_conditions" },
    cycleId: C1,
    ownerId: U.sofia,
    dealType: "senior_secured",
    requestedAmount: usd(48),
    proposedAmount: usd(45),
    industry: "Shipping",
    location: "Amsterdam, Netherlands",
    targetCloseDate: "2026-11-20",
    riskLevel: "elevated",
    ddLevel: 7,
    tags: ["conditions-precedent"],
    createdAt: "2026-08-20T09:00:00Z",
    updatedAt: "2026-10-02T09:00:00Z",
  },
  {
    id: "deal-lumen",
    name: "Project Lumen",
    borrowerName: "Lumen Retail Holdings",
    workflow: { stage: "declined", status: "declined" },
    cycleId: C0,
    ownerId: U.lead,
    dealType: "second_lien",
    requestedAmount: usd(28),
    industry: "Retail",
    location: "Austin, USA",
    riskLevel: "high",
    ddLevel: 5,
    tags: ["declined-leverage"],
    createdAt: "2026-08-10T09:00:00Z",
    updatedAt: "2026-10-01T17:00:00Z",
  },
  {
    id: "deal-quartz",
    name: "Project Quartz",
    borrowerName: "Quartz Industrial Materials",
    workflow: { stage: "closed", status: "funded" },
    cycleId: C0,
    ownerId: U.sofia,
    dealType: "senior_secured",
    requestedAmount: usd(40),
    proposedAmount: usd(40),
    industry: "Industrials",
    location: "Milan, Italy",
    riskLevel: "low",
    ddLevel: 7,
    tags: ["funded"],
    createdAt: "2026-07-15T09:00:00Z",
    updatedAt: "2026-10-05T09:00:00Z",
  },
  {
    id: "deal-zephyr",
    name: "Project Zephyr",
    borrowerName: "Zephyr Mobility",
    workflow: { stage: "teaser_evaluation", status: "screening" },
    ownerId: U.lead,
    dealType: "other",
    requestedAmount: usd(18),
    industry: "Mobility",
    location: "CDMX, Mexico",
    riskLevel: "unknown",
    ddLevel: -1,
    tags: ["inbound"],
    createdAt: "2026-10-16T13:00:00Z",
  },
];

export const BLOCK_TITLES: Record<TDiligenceBlockType, string> = {
  financial_analysis: "Financial reporting analysis",
  management_reporting: "Management reporting analysis",
  credit_analysis: "Credit analysis",
  business_overview: "Business overview",
  market_analysis: "Market analysis",
  legal_due_diligence: "Legal due diligence",
  investment_thesis: "Investment thesis",
};

const levelToReadiness = (i: number, n: number): TReadiness =>
  n < 0 ? "not_started" : i < n ? "complete" : i === n ? "in_progress" : "not_started";

const READINESS_SCORE: Record<TReadiness, number> = {
  not_started: 0,
  in_progress: 40,
  needs_review: 75,
  complete: 100,
};
export const computeReadiness = (blocks: { readiness: TReadiness }[]) =>
  blocks.length
    ? Math.round(blocks.reduce((s, b) => s + READINESS_SCORE[b.readiness], 0) / blocks.length)
    : 0;

const genericFin = (amt: number): FinancialMetrics => ({
  revenue: usd(amt * 3),
  ebitda: usd(amt * 0.7),
  totalDebt: usd(amt * 2.2),
  cash: usd(amt * 0.2),
  netDebt: usd(amt * 2.0),
  leverage: 3.1,
  nplRatio: 1.4,
});

const NORTHWIND_FIN: FinancialMetrics = {
  revenue: usd(128),
  ebitda: usd(11.5),
  totalDebt: usd(82),
  cash: usd(6.2),
  netDebt: usd(75.8),
  leverage: 7.1,
  nplRatio: 6.8,
};

const blockPatches: Record<string, Partial<DiligenceBlockBase>> = {
  "deal-northwind:financial_analysis": {
    documentIds: ["doc-nw-fin"],
    findingIds: ["fnd-nw-1", "fnd-nw-2"],
  },
};

export function makeBlock(
  dealId: string,
  type: TDiligenceBlockType,
  readiness: TReadiness,
  ownerId: string,
  metrics?: FinancialMetrics,
  createdAt = "2026-10-02T09:00:00Z",
): DiligenceBlock {
  const base: DiligenceBlockBase = {
    ...audit(ownerId, createdAt),
    id: `blk-${dealId}-${type}`,
    dealId,
    title: BLOCK_TITLES[type],
    readiness,
    ownerId,
    documentIds: [],
    findingIds: [],
    ...blockPatches[`${dealId}:${type}`],
  };
  if (type === "financial_analysis")
    return {
      ...base,
      type,
      content: { reportingPeriod: "FY2025 / LTM Jun-2026", metrics: metrics ?? {} },
    };
  if (type === "management_reporting")
    return { ...base, type, content: { metrics: {}, reconciliationStatus: "not_started" } };
  return { ...base, type, content: {} };
}

const SENIORITY = {
  senior_secured: "senior_secured",
  unitranche: "unitranche",
  second_lien: "second_lien",
  mezzanine: "subordinated",
  asset_based: "senior_secured",
  other: "unsecured",
} as const;

function securitiesFor(d: Deal): Security[] {
  const stage = d.workflow.stage;
  if (stage === "teaser_evaluation") return [];
  if (d.id === "deal-northwind") {
    const a = audit(U.lead, "2026-10-08T09:00:00Z");
    const rate = { benchmark: "SOFR", spreadBps: 625, floorBps: 100 };
    return [
      {
        ...a,
        id: "sec-nw-tla",
        dealId: d.id,
        name: "Term Loan A",
        type: "term_loan",
        seniority: "senior_secured",
        status: "proposed",
        commitmentAmount: usd(30),
        interestRate: rate,
        maturityDate: "2031-12-15",
        amortizationDescription: "2% p.a., balance bullet",
        collateralDescription: "First-ranking pledge over shares and fleet assets",
        covenantSummary: "Net leverage ≤ 5.5x stepping down; min. liquidity $5M",
      },
      {
        ...a,
        id: "sec-nw-rcf",
        dealId: d.id,
        name: "Revolving Credit Facility",
        type: "revolver",
        seniority: "super_senior",
        status: "proposed",
        commitmentAmount: usd(10),
        interestRate: { ...rate, spreadBps: 550 },
        maturityDate: "2030-12-15",
      },
    ];
  }
  const status =
    stage === "closed"
      ? "funded"
      : stage === "approved"
        ? "approved"
        : stage === "declined"
          ? "cancelled"
          : stage === "due_diligence"
            ? "proposed"
            : "under_review";
  return [
    {
      ...audit(d.ownerId, d.createdAt),
      id: `sec-${d.id}-1`,
      dealId: d.id,
      name: d.dealType === "mezzanine" ? "Mezzanine Notes" : "Term Loan",
      type: "term_loan",
      seniority: SENIORITY[d.dealType ?? "other"],
      status,
      commitmentAmount: d.proposedAmount ?? d.requestedAmount ?? usd(0),
      fundedAmount: status === "funded" ? (d.proposedAmount ?? undefined) : undefined,
      interestRate: { benchmark: "SOFR", spreadBps: 575, floorBps: 100 },
      maturityDate: "2031-12-31",
    },
  ];
}

export function createSeed(): Db {
  const deals: Deal[] = [];
  const diligenceBlocks: DiligenceBlock[] = [];
  const securities: Security[] = [];
  const documents: DealDocument[] = [];
  const activity: ActivityEvent[] = [];

  for (const s of dealSeeds) {
    const { ddLevel, readinessOverride, createdAt, updatedAt, ...rest } = s;
    const blocks = DILIGENCE_BLOCK_TYPES.map((type, i) => {
      const readiness = readinessOverride?.[i] ?? levelToReadiness(i, ddLevel);
      const amt = (rest.requestedAmount?.amount ?? 0) / 1_000_000;
      const metrics =
        rest.id === "deal-northwind"
          ? NORTHWIND_FIN
          : readiness === "not_started"
            ? undefined
            : genericFin(amt);
      return makeBlock(rest.id, type, readiness, rest.ownerId, metrics);
    });
    diligenceBlocks.push(...blocks);

    const deal: Deal = {
      ...audit(rest.ownerId, createdAt),
      updatedAt: updatedAt ?? createdAt,
      teamMemberIds: [],
      tags: [],
      diligenceReadiness: computeReadiness(blocks),
      ...rest,
    };
    deals.push(deal);
    securities.push(...securitiesFor(deal));

    documents.push({
      ...audit(rest.ownerId, createdAt),
      id: `doc-${rest.id}-teaser`,
      dealId: rest.id,
      name: `${rest.name.replace("Project ", "")}_Teaser.pdf`,
      type: "teaser",
      mimeType: "application/pdf",
      sizeBytes: 1_480_000,
      uploadedBy: rest.ownerId,
      uploadedAt: createdAt,
      processingStatus: "parsed",
    });
    activity.push({
      id: `act-${rest.id}-created`,
      dealId: rest.id,
      actorId: rest.ownerId,
      type: "deal_created",
      timestamp: createdAt,
      summary: `Deal created: ${rest.name}`,
      entityType: "deal",
      entityId: rest.id,
    });
  }

  // Hero deal
  const t = (d: string) => `2026-10-${d}Z`;
  documents.push({
    ...audit(U.analyst, t("12T10:15:00")),
    id: "doc-nw-fin",
    dealId: "deal-northwind",
    name: "Northwind_Financing_Report_Q2_2026.pdf",
    type: "financing_report",
    mimeType: "application/pdf",
    sizeBytes: 3_900_000,
    uploadedBy: U.analyst,
    uploadedAt: t("12T10:15:00"),
    processingStatus: "parsed",
    extractedFields: {
      totalDebt: {
        value: usd(82),
        sourceDocumentId: "doc-nw-fin",
        sourceLocation: { page: 14, section: "Consolidated debt schedule" },
        confidence: 0.96,
      },
      nplRatio: {
        value: 6.8,
        sourceDocumentId: "doc-nw-fin",
        sourceLocation: { page: 22, section: "Asset quality" },
        confidence: 0.93,
      },
    },
  });

  const findings: Finding[] = [
    {
      ...audit(U.analyst, t("12T10:20:00")),
      id: "fnd-nw-1",
      dealId: "deal-northwind",
      title: "NPL ratio exceeds fund limit",
      description: "Financing report shows an NPL ratio of 6.8% versus the fund limit of 3%.",
      source: "ai_analysis",
      status: "open",
      severity: "high",
      sourceDocumentIds: ["doc-nw-fin"],
      relatedBlockIds: ["blk-deal-northwind-financial_analysis"],
    },
    {
      ...audit(U.analyst, t("12T10:20:00")),
      id: "fnd-nw-2",
      dealId: "deal-northwind",
      title: "Leverage above policy limit",
      description:
        "Total debt of $82M against EBITDA of $11.5M implies 7.1x leverage (policy max 5.0x).",
      source: "rule",
      status: "open",
      severity: "high",
      sourceDocumentIds: ["doc-nw-fin"],
      relatedBlockIds: ["blk-deal-northwind-financial_analysis"],
    },
    {
      ...audit(U.sofia, t("13T16:45:00")),
      id: "fnd-falcon-1",
      dealId: "deal-falcon",
      title: "Top-3 customers are 71% of revenue",
      description:
        "Customer concentration is above the 50% soft limit; waiting on contract copies from the sponsor.",
      source: "manual_review",
      status: "under_review",
      severity: "elevated",
      sourceDocumentIds: [],
      relatedBlockIds: [],
    },
  ];

  activity.push(
    {
      id: "act-nw-doc",
      dealId: "deal-northwind",
      actorId: U.analyst,
      type: "document_uploaded",
      timestamp: t("12T10:15:00"),
      summary: "Uploaded Northwind_Financing_Report_Q2_2026.pdf",
      entityType: "document",
      entityId: "doc-nw-fin",
    },
    {
      id: "act-nw-parsed",
      dealId: "deal-northwind",
      actorId: U.analyst,
      type: "document_parsed",
      timestamp: t("12T10:18:00"),
      summary: "Financing report parsed: 2 metrics extracted",
      entityType: "document",
      entityId: "doc-nw-fin",
    },
    {
      id: "act-nw-f1",
      dealId: "deal-northwind",
      actorId: U.analyst,
      type: "finding_created",
      timestamp: t("12T10:20:00"),
      summary: "AI flagged: NPL ratio exceeds fund limit",
      entityType: "finding",
      entityId: "fnd-nw-1",
    },
  );

  return {
    users,
    roles,
    cycles,
    deals,
    securities,
    diligenceBlocks,
    documents,
    findings,
    activity,
    adjustments: [],
    notifications: [],
    memos: [],
  };
}
