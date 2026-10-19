import { Chip } from "@mui/material";
import type { TRiskLevel } from "../types/common";

const COLOR: Record<TRiskLevel, "success" | "info" | "warning" | "error" | "default"> = {
  low: "success",
  moderate: "info",
  elevated: "warning",
  high: "error",
  critical: "error",
  unknown: "default",
};

export default function RiskLevelChip({
  level,
  variant = "filled",
}: {
  level: TRiskLevel;
  variant?: "filled" | "outlined";
}) {
  return (
    <Chip
      size="small"
      variant={variant}
      color={COLOR[level]}
      label={level.charAt(0).toUpperCase() + level.slice(1)}
      sx={{ fontWeight: 600, minWidth: 78 }}
    />
  );
}
