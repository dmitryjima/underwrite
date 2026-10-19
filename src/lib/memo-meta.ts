import type { TMemoStatus, TMemoType } from "../types/memos";
// (TMemoStatus and TMemoType both come from your memos.ts)
import type { TPermissionArea } from "../types/users";

export const MEMO_TYPES: { id: TMemoType; label: string; description: string }[] = [
  {
    id: "preliminary",
    label: "Preliminary",
    description: "Short screening memo: terms, headline financials, key risks.",
  },
  {
    id: "full",
    label: "Full",
    description:
      "Complete credit memo with reconciliation, mitigants, diligence status and sources.",
  },
  {
    id: "final",
    label: "Final",
    description: "Full memo plus the IC decision and conditions block, ready for sign-off.",
  },
];

export const MEMO_TYPE_LABEL = Object.fromEntries(MEMO_TYPES.map((t) => [t.id, t.label])) as Record<
  TMemoType,
  string
>;

export const MEMO_STATUS_META: Record<
  TMemoStatus,
  { label: string; color: "default" | "info" | "warning" | "success" }
> = {
  draft: { label: "Draft", color: "default" },
  in_review: { label: "In review", color: "info" },
  ready_for_ic: { label: "Ready for IC", color: "warning" },
  approved: { label: "Approved", color: "success" },
  superseded: { label: "Superseded", color: "default" },
};

export const memoArea = (type: TMemoType): TPermissionArea =>
  type === "final" ? "deal_ic_memo_final" : "deal_ic_memo_preliminary";

export const MEMO_TRANSITIONS: Partial<
  Record<
    TMemoStatus,
    { to: TMemoStatus; label: string; primary?: boolean; needsFinalWrite?: boolean }[]
  >
> = {
  draft: [{ to: "in_review", label: "Send for review", primary: true }],
  in_review: [
    { to: "ready_for_ic", label: "Mark ready for IC", primary: true },
    { to: "draft", label: "Back to draft" },
  ],
  ready_for_ic: [
    { to: "approved", label: "Approve", primary: true, needsFinalWrite: true },
    { to: "in_review", label: "Back to review" },
  ],
};

export const isEditable = (status: TMemoStatus) => status === "draft" || status === "in_review";
