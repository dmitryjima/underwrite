import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import HistoryChart from "../../components/HistoryChart";
import { FUND_POLICY } from "../../lib/deal-meta";
import { cagr, num, type HistPoint, type HistoryRange } from "../../lib/history";
import type { FinancialMetrics } from "../../types/diligence";

const money = (n: number | undefined, currency = "USD") =>
  n === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
const pct = (n: number | undefined, d = 1) => (n === undefined ? "—" : `${n.toFixed(d)}%`);
const signed = (n: number | undefined, suffix: string) =>
  n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}${suffix}`;

interface Props {
  points: HistPoint[];
  /** Same periods as `points` where available, e.g. management accounts next to the financing report. */
  overlay?: HistPoint[];
  overlayName?: string;
  seriesName: string;
  range: HistoryRange;
  synthetic?: boolean;
}

interface Row {
  label: string;
  get: (m: FinancialMetrics) => number | undefined;
  fmt: (n: number | undefined) => string;
  trend: (first: number | undefined, last: number | undefined, years: number) => string;
  bad?: (n: number | undefined) => boolean;
}

export default function MetricsHistory({
  points,
  overlay,
  overlayName = "Management",
  seriesName,
  range,
  synthetic,
}: Props) {
  const theme = useTheme();
  const cur = points.find((p) => p.m.revenue)?.m.revenue?.currency ?? "USD";
  const periods = points.map((p) => p.period);
  const overlayAt = periods.map((p) => overlay?.find((o) => o.period === p)?.m);
  const hasOverlay = overlayAt.some(Boolean);
  const years = Math.max(1, points.length - 1);

  const rows: Row[] = [
    {
      label: "Revenue",
      get: (m) => m.revenue?.amount,
      fmt: (n) => money(n, cur),
      trend: (a, b, y) => signed(cagr(a, b, y), "% CAGR"),
    },
    {
      label: "EBITDA",
      get: (m) => m.ebitda?.amount,
      fmt: (n) => money(n, cur),
      trend: (a, b, y) => signed(cagr(a, b, y), "% CAGR"),
    },
    {
      label: "EBITDA margin",
      get: (m) => num.margin(m),
      fmt: (n) => pct(n),
      trend: (a, b) => (a !== undefined && b !== undefined ? signed(b - a, " pp") : "—"),
    },
    {
      label: "Total debt",
      get: (m) => m.totalDebt?.amount,
      fmt: (n) => money(n, cur),
      trend: (a, b, y) => signed(cagr(a, b, y), "% CAGR"),
    },
    {
      label: "Cash",
      get: (m) => m.cash?.amount,
      fmt: (n) => money(n, cur),
      trend: (a, b, y) => signed(cagr(a, b, y), "% CAGR"),
    },
    {
      label: "Leverage",
      get: (m) => m.leverage,
      fmt: (n) => (n === undefined ? "—" : `${n.toFixed(1)}x`),
      trend: (a, b) => (a !== undefined && b !== undefined ? signed(b - a, "x") : "—"),
      bad: (n) => (n ?? 0) > FUND_POLICY.maxLeverage,
    },
    {
      label: "NPL ratio",
      get: (m) => m.nplRatio,
      fmt: (n) => pct(n),
      trend: (a, b) => (a !== undefined && b !== undefined ? signed(b - a, " pp") : "—"),
      bad: (n) => (n ?? 0) > FUND_POLICY.maxNplRatio,
    },
  ].filter((r) => points.some((p) => r.get(p.m) !== undefined)) as Row[];

  const values = (get: Row["get"], src: (FinancialMetrics | undefined)[]) =>
    src.map((m) => (m ? get(m) : undefined));
  const mine = points.map((p) => p.m);
  const primary = theme.palette.primary.main;
  const second = theme.palette.info.main;
  const lev = (n: number) => `${n.toFixed(1)}x`;
  const p1 = (n: number) => `${n.toFixed(1)}%`;
  const trendHead = range === "5y" ? "5-year change" : "3-year change";

  const chart = (
    title: string,
    get: Row["get"],
    format: (n: number) => string,
    withOverlay: boolean,
    threshold?: { value: number; label: string },
  ) => (
    <HistoryChart
      title={title}
      labels={periods}
      format={format}
      threshold={threshold}
      series={[
        { name: seriesName, color: primary, values: values(get, mine) },
        ...(withOverlay && hasOverlay
          ? [{ name: overlayName, color: second, dashed: true, values: values(get, overlayAt) }]
          : []),
      ]}
    />
  );

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}
      >
        {chart("Leverage (debt / EBITDA)", (m) => m.leverage, lev, true, {
          value: FUND_POLICY.maxLeverage,
          label: `Policy max ${FUND_POLICY.maxLeverage}x`,
        })}
        {chart("NPL ratio", (m) => m.nplRatio, p1, true, {
          value: FUND_POLICY.maxNplRatio,
          label: `Fund limit ${FUND_POLICY.maxNplRatio}%`,
        })}
        {chart(
          "Revenue",
          (m) => m.revenue?.amount,
          (n) => money(n, cur),
          false,
        )}
        {chart("EBITDA margin", (m) => num.margin(m), p1, false)}
      </Box>

      <Box sx={{ overflowX: "auto", mt: 2.5 }}>
        <Table size="small" sx={{ minWidth: 520, "& td, & th": { px: 1, py: 0.75 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{seriesName}</TableCell>
              {periods.map((p) => (
                <TableCell key={p} align="right" sx={{ fontWeight: 700 }}>
                  {p}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {trendHead}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const first = r.get(points[0].m),
                last = r.get(points.at(-1)!.m);
              return (
                <TableRow key={r.label}>
                  <TableCell sx={{ color: "text.secondary" }}>{r.label}</TableCell>
                  {points.map((p, i) => {
                    const v = r.get(p.m);
                    const bad = r.bad?.(v);
                    return (
                      <TableCell
                        key={i}
                        align="right"
                        sx={{
                          fontWeight: p.current ? 700 : 400,
                          color: bad ? "error.main" : "text.primary",
                        }}
                      >
                        {r.fmt(v)}
                      </TableCell>
                    );
                  })}
                  <TableCell align="right" sx={{ color: "text.secondary" }}>
                    {r.trend(first, last, years)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
        {hasOverlay ? `Dashed line: ${overlayName.toLowerCase()} view of the same periods. ` : ""}
        {synthetic ? "Prior years are illustrative in this demo. " : ""}
        “Current” is the live figure on the deal, including accepted adjustments.
      </Typography>
    </Box>
  );
}
