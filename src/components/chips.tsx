import { Chip } from "@mui/material";
import type { TRiskLevel } from "../types/common";
import type { TDealWorkflow } from "../types/deals";
import { RISK_META, STAGE_BY_ID, humanize } from "../lib/deal-meta";

export function RiskChip({ level }: { level: TRiskLevel }) {
  const m = RISK_META[level];
  return (
    <Chip
      size="small"
      label={m.label}
      color={m.color}
      variant={level === "unknown" ? "outlined" : "filled"}
    />
  );
}

export function StageChip({
  workflow,
  showStatus = true,
}: {
  workflow: TDealWorkflow;
  showStatus?: boolean;
}) {
  const s = STAGE_BY_ID[workflow.stage];
  return (
    <Chip
      size="small"
      label={showStatus ? `${s.label} · ${humanize(workflow.status)}` : s.label}
      sx={{ bgcolor: `${s.color}1a`, color: s.color, fontWeight: 600 }}
    />
  );
}
