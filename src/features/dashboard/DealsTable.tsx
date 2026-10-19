import {
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import type { DealSortKey } from "../../api/client";
import OwnerAvatar from "../../components/OwnerAvatar";
import { RiskChip, StageChip } from "../../components/chips";
import { DEAL_TYPE_LABELS } from "../../lib/deal-meta";
import { formatDate, formatMoney } from "../../lib/format";
import type { Deal } from "../../types/deals";
import type { User } from "../../types/users";

interface Props {
  items: Deal[];
  usersById: Record<string, User>;
  sort: DealSortKey;
  dir: "asc" | "desc";
  onSort: (k: DealSortKey) => void;
  onOpen: (id: string) => void;
}

const COLUMNS: { label: string; key?: DealSortKey; align?: "right" }[] = [
  { label: "Deal", key: "name" },
  { label: "Stage", key: "stage" },
  { label: "Type" },
  { label: "Requested", key: "amount", align: "right" },
  { label: "Risk", key: "risk" },
  { label: "Readiness", key: "readiness" },
  { label: "Next IC", key: "icDate" },
  { label: "Owner" },
  { label: "Updated", key: "updatedAt" },
];

export default function DealsTable({ items, usersById, sort, dir, onSort, onOpen }: Props) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            {COLUMNS.map((c) => (
              <TableCell
                key={c.label}
                align={c.align}
                sortDirection={sort === c.key ? dir : false}
                sx={{ textWrap: "nowrap" }}
              >
                {c.key ? (
                  <TableSortLabel
                    active={sort === c.key}
                    direction={sort === c.key ? dir : "asc"}
                    onClick={() => onSort(c.key!)}
                  >
                    {c.label}
                  </TableSortLabel>
                ) : (
                  c.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((d) => (
            <TableRow key={d.id} hover onClick={() => onOpen(d.id)} sx={{ cursor: "pointer" }}>
              <TableCell>
                <Typography sx={{ fontWeight: 600 }}>{d.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.borrowerName}
                </Typography>
              </TableCell>
              <TableCell>
                <StageChip workflow={d.workflow} />
              </TableCell>
              <TableCell>{d.dealType ? DEAL_TYPE_LABELS[d.dealType] : "—"}</TableCell>
              <TableCell align="right">{formatMoney(d.requestedAmount)}</TableCell>
              <TableCell>
                <RiskChip level={d.riskLevel} />
              </TableCell>
              <TableCell sx={{ minWidth: 130 }}>
                <LinearProgress
                  variant="determinate"
                  value={d.diligenceReadiness}
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {d.diligenceReadiness}%
                </Typography>
              </TableCell>
              <TableCell>{formatDate(d.nextIcDate)}</TableCell>
              <TableCell>
                <span style={{ textWrap: "nowrap" }}>{usersById[d.ownerId]?.name}</span>
              </TableCell>
              <TableCell>{formatDate(d.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
