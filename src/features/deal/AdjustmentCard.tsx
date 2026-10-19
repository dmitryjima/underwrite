import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlineOutlined";
import HighlightOff from "@mui/icons-material/HighlightOff";
import type { Adjustment } from "../../types/adjustments";
import type { FinancialMetrics } from "../../types/diligence";
import { RiskChip } from "../../components/chips";
import { FUND_POLICY, humanize } from "../../lib/deal-meta";
import { formatDateTime, formatMoney } from "../../lib/format";

interface Props {
  adjustment: Adjustment;
  canDecide: boolean;
  busy: boolean;
  decidedByName?: string;
  onDecide: (decision: "accepted" | "rejected", comment?: string) => void;
}

interface Row {
  label: string;
  before: string;
  after: string;
  badBefore?: boolean;
  badAfter?: boolean;
}

function rowsOf(b: FinancialMetrics, a: FinancialMetrics): Row[] {
  const rows: Row[] = [];
  if (b.totalDebt?.amount !== a.totalDebt?.amount)
    rows.push({
      label: "Total debt",
      before: formatMoney(b.totalDebt),
      after: formatMoney(a.totalDebt),
    });
  if (b.netDebt?.amount !== a.netDebt?.amount)
    rows.push({ label: "Net debt", before: formatMoney(b.netDebt), after: formatMoney(a.netDebt) });
  if (b.leverage !== a.leverage)
    rows.push({
      label: "Leverage",
      before: `${b.leverage}x`,
      after: `${a.leverage}x`,
      badBefore: (b.leverage ?? 0) > FUND_POLICY.maxLeverage,
      badAfter: (a.leverage ?? 0) > FUND_POLICY.maxLeverage,
    });
  if (b.nplRatio !== a.nplRatio)
    rows.push({
      label: "NPL ratio",
      before: `${b.nplRatio}%`,
      after: `${a.nplRatio}%`,
      badBefore: (b.nplRatio ?? 0) > FUND_POLICY.maxNplRatio,
      badAfter: (a.nplRatio ?? 0) > FUND_POLICY.maxNplRatio,
    });
  return rows;
}

export default function AdjustmentCard({
  adjustment: adj,
  canDecide,
  busy,
  decidedByName,
  onDecide,
}: Props) {
  const [declining, setDeclining] = useState(false);
  const [comment, setComment] = useState("");
  const pending = adj.status === "proposed";

  if (!pending) {
    const accepted = adj.status === "accepted";
    return (
      <Card sx={{ borderColor: accepted ? "success.main" : "divider" }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack sx={{ flexDirection: "row", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            {accepted ? <CheckCircleOutline color="success" /> : <HighlightOff color="disabled" />}
            <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
              {adj.title}
            </Typography>
            <Chip
              size="small"
              label={humanize(adj.status)}
              color={accepted ? "success" : "default"}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {decidedByName} · {formatDateTime(adj.decidedAt)}
            </Typography>
          </Stack>
          {adj.decisionComment && (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
            >
              “{adj.decisionComment}”
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderColor: "secondary.main",
        borderWidth: 2,
        background: "linear-gradient(135deg, rgba(124,58,237,0.07), rgba(35,69,199,0.04))",
      }}
    >
      <CardContent>
        <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center", mb: 1 }}>
          <Chip size="small" color="secondary" icon={<AutoAwesome />} label="AI suggestion" />
          <Chip
            size="small"
            variant="outlined"
            label={`${Math.round(adj.confidence * 100)}% confidence`}
          />
        </Stack>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {adj.title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 2 }}>
          {adj.rationale}
        </Typography>

        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              <TableCell align="right">Reported</TableCell>
              <TableCell />
              <TableCell align="right">Suggested</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowsOf(adj.before, adj.after).map((r) => (
              <TableRow key={r.label}>
                <TableCell sx={{ fontWeight: 600 }}>{r.label}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color: r.badBefore ? "error.main" : "text.primary",
                    fontWeight: r.badBefore ? 700 : 400,
                  }}
                >
                  {r.before}
                </TableCell>
                <TableCell align="center" sx={{ width: 32 }}>
                  <ArrowForward fontSize="small" sx={{ color: "text.disabled" }} />
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: r.badAfter ? "error.main" : "success.main", fontWeight: 700 }}
                >
                  {r.after}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center", mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Deal risk
          </Typography>
          <RiskChip level={adj.riskBefore} />
          <ArrowForward fontSize="small" sx={{ color: "text.disabled" }} />
          <RiskChip level={adj.riskAfter} />
        </Stack>

        {adj.evidence.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              EVIDENCE
            </Typography>
            {adj.evidence.map((e, i) => (
              <Typography key={i} variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {e.label}
                </Box>
                {e.location ? ` · ${e.location}` : ""}
              </Typography>
            ))}
          </Box>
        )}

        {canDecide ? (
          declining ? (
            <Stack sx={{ gap: 1 }}>
              <TextField
                size="small"
                multiline
                minRows={2}
                label="Reason (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Stack sx={{ flexDirection: "row", gap: 1 }}>
                <Button
                  color="error"
                  variant="contained"
                  disabled={busy}
                  onClick={() => onDecide("rejected", comment)}
                >
                  Confirm decline
                </Button>
                <Button disabled={busy} onClick={() => setDeclining(false)}>
                  Back
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack sx={{ flexDirection: "row", gap: 1 }}>
              <Button variant="contained" disabled={busy} onClick={() => onDecide("accepted")}>
                Accept adjustment
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                disabled={busy}
                onClick={() => setDeclining(true)}
              >
                Decline
              </Button>
            </Stack>
          )
        ) : (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            You don’t have permission to decide on findings.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
