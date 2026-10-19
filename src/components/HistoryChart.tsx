import { Box, Typography, useTheme } from "@mui/material";

export interface ChartSeries {
  name: string;
  color: string;
  dashed?: boolean;
  values: (number | undefined)[];
}

interface Props {
  title: string;
  labels: string[];
  series: ChartSeries[];
  format: (n: number) => string;
  threshold?: { value: number; label: string };
}

const W = 360,
  H = 170,
  PAD = { l: 40, r: 14, t: 14, b: 26 };

export default function HistoryChart({ title, labels, series, format, threshold }: Props) {
  const theme = useTheme();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== undefined));
  if (all.length === 0) return null;
  let lo = Math.min(...all, threshold?.value ?? Infinity);
  let hi = Math.max(...all, threshold?.value ?? -Infinity);
  const span = hi - lo || Math.abs(hi) || 1;
  lo = Math.max(0, lo - span * 0.12);
  hi = hi + span * 0.18;
  const n = labels.length;
  const x = (i: number) =>
    PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const grid = theme.palette.divider;
  const muted = theme.palette.text.secondary;

  const path = (vals: (number | undefined)[]) => {
    let d = "",
      pen = false;
    vals.forEach((v, i) => {
      if (v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  return (
    <Box>
      <ChartHeader title={title} series={series} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${title}: ${series.map((s) => s.name).join(", ")}`}
        style={{ display: "block" }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill={muted}>
              {format(t)}
            </text>
          </g>
        ))}
        {threshold && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(threshold.value)}
              y2={y(threshold.value)}
              stroke={theme.palette.error.main}
              strokeWidth={1.2}
              strokeDasharray="4 3"
            />
            <text
              x={W - PAD.r}
              y={y(threshold.value) - 4}
              fontSize={9}
              textAnchor="end"
              fill={theme.palette.error.main}
            >
              {threshold.label}
            </text>
          </g>
        )}
        {labels.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - 8} fontSize={9} textAnchor="middle" fill={muted}>
            {l}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
            />
            {s.values.map((v, i) =>
              v === undefined ? null : (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={i === n - 1 ? 3.8 : 2.6}
                  fill={s.dashed ? theme.palette.background.paper : s.color}
                  stroke={s.color}
                  strokeWidth={1.5}
                >
                  <title>{`${s.name}, ${labels[i]}: ${format(v)}`}</title>
                </circle>
              ),
            )}
            {(() => {
              const i = s.values.length - 1;
              const v = s.values[i];
              return v === undefined ? null : (
                <text
                  x={x(i)}
                  y={y(v) - 8}
                  fontSize={10}
                  fontWeight={700}
                  textAnchor={n === 1 ? "middle" : "end"}
                  fill={s.color}
                >
                  {format(v)}
                </text>
              );
            })()}
          </g>
        ))}
      </svg>
    </Box>
  );
}

function ChartHeader({ title, series }: { title: string; series: ChartSeries[] }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        mb: 0.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </Typography>
      {series.length > 1 && (
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {series.map((s) => (
            <Box key={s.name} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box
                sx={{
                  width: 14,
                  height: 0,
                  borderTop: `2px ${s.dashed ? "dashed" : "solid"} ${s.color}`,
                }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {s.name}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
