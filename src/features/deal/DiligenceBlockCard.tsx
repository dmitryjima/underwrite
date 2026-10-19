import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import UploadFile from "@mui/icons-material/UploadFile";
import type { DiligenceBlock, FinancialMetrics } from "../../types/diligence";
import type { TDocumentType } from "../../types/documents";
import { FUND_POLICY, READINESS_META, humanize } from "../../lib/deal-meta";
import { formatMoney } from "../../lib/format";
import { sliceRange, type HistoryBundle, type HistoryRange } from "../../lib/history";
import MetricsHistory from "./MetricsHistory";

const Fact = ({ label, value, bad }: { label: string; value: React.ReactNode; bad?: boolean }) => (
  <Box>
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ fontWeight: 600, color: bad ? "error.main" : "text.primary" }}
    >
      {value}
    </Typography>
  </Box>
);

function Metrics({ m }: { m: FinancialMetrics }) {
  const lev = (m.leverage ?? 0) > FUND_POLICY.maxLeverage;
  const npl = (m.nplRatio ?? 0) > FUND_POLICY.maxNplRatio;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5, mt: 2 }}>
      <Fact label="Revenue" value={formatMoney(m.revenue)} />
      <Fact label="EBITDA" value={formatMoney(m.ebitda)} />
      <Fact label="Total debt" value={formatMoney(m.totalDebt)} />
      <Fact label="Net debt" value={formatMoney(m.netDebt)} />
      <Fact
        label="Leverage"
        bad={lev}
        value={
          m.leverage !== undefined
            ? `${m.leverage}x${lev ? ` (max ${FUND_POLICY.maxLeverage}x)` : ""}`
            : "—"
        }
      />
      <Fact
        label="NPL ratio"
        bad={npl}
        value={
          m.nplRatio !== undefined
            ? `${m.nplRatio}%${npl ? ` (limit ${FUND_POLICY.maxNplRatio}%)` : ""}`
            : "—"
        }
      />
    </Box>
  );
}

interface Props {
  block: DiligenceBlock;
  canUpload: boolean;
  onUpload: (type: TDocumentType) => void;
  range: HistoryRange;
  history: HistoryBundle;
}

export default function DiligenceBlockCard({
  block: b,
  canUpload,
  onUpload,
  range,
  history,
}: Props) {
  const r = READINESS_META[b.readiness];
  const uploadType: TDocumentType | undefined =
    b.type === "financial_analysis"
      ? "financing_report"
      : b.type === "management_reporting"
        ? "management_report"
        : undefined;
  const metrics =
    b.type === "financial_analysis" || b.type === "management_reporting"
      ? b.content.metrics
      : undefined;

  // history applies to the two analysis blocks only
  const isFin = b.type === "financial_analysis";
  const series = isFin
    ? history.financial
    : b.type === "management_reporting"
      ? history.management
      : undefined;
  const points = series ? sliceRange(series, range) : [];
  const showHistory = range !== "latest" && points.length > 1;
  const historyUnavailable =
    range !== "latest" && (isFin || b.type === "management_reporting") && !showHistory;

  return (
    <Card sx={showHistory ? { gridColumn: "1 / -1" } : undefined}>
      <CardContent>
        <Stack
          sx={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {b.title}
          </Typography>
          <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
            {showHistory && (
              <Chip
                size="small"
                variant="outlined"
                label={range === "3y" ? "3-year view" : "5-year view"}
              />
            )}
            <Chip size="small" color={r.color} label={r.label} />
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {b.documentIds.length} documents · {b.findingIds.length} findings
          {b.type === "financial_analysis" && b.content.reportingPeriod
            ? ` · ${b.content.reportingPeriod}`
            : ""}
        </Typography>

        {showHistory ? (
          <MetricsHistory
            points={points}
            seriesName={isFin ? "Financing report" : "Management accounts"}
            overlay={
              isFin ? history.management && sliceRange(history.management, range) : undefined
            }
            overlayName="Management accounts"
            range={range}
            synthetic={history.synthetic && isFin}
          />
        ) : (
          metrics && Object.keys(metrics).length > 0 && <Metrics m={metrics} />
        )}
        {historyUnavailable && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1.5 }}>
            {b.type === "management_reporting"
              ? "Historical management accounts appear here once a management report has been uploaded."
              : "No historical figures are available for this deal yet. Showing the latest period."}
          </Typography>
        )}

        {b.type === "management_reporting" && (
          <Box sx={{ mt: 2 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Reconciliation: ${humanize(b.content.reconciliationStatus)}`}
              color={
                b.content.reconciliationStatus === "discrepancy_found"
                  ? "warning"
                  : b.content.reconciliationStatus === "reconciled"
                    ? "success"
                    : "default"
              }
            />
            {b.content.reconciliationStatus === "not_started" && (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                Upload a management report (XLSX or DOCX) to reconcile it with the financing report.
              </Typography>
            )}
            {b.content.commentary && (
              <Alert severity="info" icon={false} sx={{ mt: 1.5, whiteSpace: "pre-line" }}>
                {b.content.commentary}
              </Alert>
            )}
          </Box>
        )}

        {uploadType && canUpload && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadFile />}
            sx={{ mt: 2 }}
            onClick={() => onUpload(uploadType)}
          >
            {uploadType === "financing_report"
              ? "Upload financing report"
              : "Upload management report"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
