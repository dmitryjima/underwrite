import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import TableRows from "@mui/icons-material/TableRows";
import ViewKanban from "@mui/icons-material/ViewKanban";
import {
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import type { appLoader, dashboardLoader } from "../routes/loaders";
import type { DealSortKey } from "../api/client";
import DealsTable from "../features/dashboard/DealsTable";
import DealsKanban from "../features/dashboard/DealsKanban";
import NewDealDialog from "../features/deal/NewDealDialog";
import { RISK_META, STAGES } from "../lib/deal-meta";
import { formatMoney } from "../lib/format";
import { can } from "../lib/permissions";
import type { User } from "../types/users";

export default function DealsDashboardPage() {
  const { filters, cycles, users, list } = useLoaderData<typeof dashboardLoader>();
  const me = useRouteLoaderData<typeof appLoader>("app")!;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();

  const [newOpen, setNewOpen] = useState(false);

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])) as Record<string, User>,
    [users],
  );
  const cycle = cycles.find((c) => c.id === filters.cycle);

  /** Every filter change is a URL change; `undefined` removes the param. */
  const update = (patch: Record<string, string | undefined>, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) {
            next.set(k, v);
          } else {
            next.delete(k);
          }
        }
        return next;
      },
      { replace },
    );

  // Debounced search box -> URL
  const [q, setQ] = useState(filters.q);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => update({ q: q || undefined }, true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onSort = (key: DealSortKey) =>
    update({ sort: key, dir: filters.sort === key && filters.dir === "desc" ? "asc" : "desc" });

  const hasFilters = !!(
    filters.q ||
    filters.stages.length ||
    filters.risks.length ||
    filters.owner
  );
  const totalRequested = list.items.reduce((s, d) => s + (d.requestedAmount?.amount ?? 0), 0);
  const avgReadiness = list.items.length
    ? Math.round(list.items.reduce((s, d) => s + d.diligenceReadiness, 0) / list.items.length)
    : 0;
  const icCount = list.items.filter((d) => d.nextIcDate).length;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction="row"
        sx={{
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h5">Deals</Typography>
          <Typography variant="body2" color="text.secondary">
            {cycle
              ? `${cycle.name} · ${cycle.description ?? ""}`
              : filters.cycle === "none"
                ? "Unassigned deals"
                : "All time"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search deals, borrowers, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 290 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filters.view}
              onChange={(_, v) => v && update({ view: v === "kanban" ? "kanban" : undefined })}
            >
              <ToggleButton value="table">
                <TableRows fontSize="small" sx={{ mr: 0.5 }} />
                Table
              </ToggleButton>
              <ToggleButton value="kanban">
                <ViewKanban fontSize="small" sx={{ mr: 0.5 }} />
                Kanban
              </ToggleButton>
            </ToggleButtonGroup>
            {can(me.role, "deals_dashboard", "write") && (
              <Button variant="contained" onClick={() => setNewOpen(true)}>
                New deal
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" },
        }}
      >
        {[
          ["Deals", String(list.total)],
          ["Requested", formatMoney({ amount: totalRequested, currency: "USD" })],
          ["Avg. diligence readiness", `${avgReadiness}%`],
          ["With IC date", String(icCount)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h6">{value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{
          flexWrap: "wrap",
          alignItems: "center",
        }}
        useFlexGap
      >
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Stage</InputLabel>
          <Select
            multiple
            label="Stage"
            value={filters.stages}
            onChange={(e) => update({ stage: (e.target.value as string[]).join(",") || undefined })}
            renderValue={(v) => `${v.length} selected`}
          >
            {STAGES.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                <Checkbox size="small" checked={filters.stages.includes(s.id)} />
                <ListItemText primary={s.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Risk</InputLabel>
          <Select
            multiple
            label="Risk"
            value={filters.risks}
            onChange={(e) => update({ risk: (e.target.value as string[]).join(",") || undefined })}
            renderValue={(v) => `${v.length} selected`}
          >
            {Object.entries(RISK_META)
              .sort((a, b) => a[1].order - b[1].order)
              .map(([id, m]) => (
                <MenuItem key={id} value={id}>
                  <Checkbox size="small" checked={filters.risks.includes(id as never)} />
                  <ListItemText primary={m.label} />
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Owner</InputLabel>
          <Select
            label="Owner"
            value={filters.owner}
            onChange={(e) => update({ owner: e.target.value || undefined })}
          >
            <MenuItem value="">Anyone</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Cycle</InputLabel>
          <Select
            label="Cycle"
            value={filters.cycle}
            onChange={(e) => update({ cycle: e.target.value })}
          >
            {cycles
              .sort((a, b) => {
                const _a = new Date(a.startDate).getTime();
                const _b = new Date(b.startDate).getTime();

                return _b - _a;
              })
              .map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            <MenuItem value="none">Unassigned</MenuItem>
            <MenuItem value="all">All time</MenuItem>
          </Select>
        </FormControl>

        {hasFilters && (
          <Button
            size="small"
            onClick={() =>
              update({ q: undefined, stage: undefined, risk: undefined, owner: undefined })
            }
          >
            Clear filters
          </Button>
        )}
      </Stack>

      <Box sx={{ height: 4 }}>{navigation.state === "loading" && <LinearProgress />}</Box>

      {list.items.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No deals match these filters.</Typography>
          </CardContent>
        </Card>
      ) : filters.view === "kanban" ? (
        <DealsKanban
          items={list.items}
          usersById={usersById}
          onOpen={(id) => navigate(`/deals/${id}`)}
        />
      ) : (
        <DealsTable
          items={list.items}
          usersById={usersById}
          sort={filters.sort}
          dir={filters.dir}
          onSort={onSort}
          onOpen={(id) => navigate(`/deals/${id}`)}
        />
      )}

      <NewDealDialog
        key={filters.cycle}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        cycles={cycles}
        users={users}
        currentUserId={me.user.id}
        defaultCycleId={cycles.some((c) => c.id === filters.cycle) ? filters.cycle : undefined}
      />
    </Stack>
  );
}
