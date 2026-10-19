import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import OwnerAvatar from "../../components/OwnerAvatar";
import { RiskChip } from "../../components/chips";
import { STAGES, humanize } from "../../lib/deal-meta";
import { formatDate, formatMoney } from "../../lib/format";
import type { Deal } from "../../types/deals";
import type { User } from "../../types/users";

interface Props {
  items: Deal[];
  usersById: Record<string, User>;
  onOpen: (id: string) => void;
}

export default function DealsKanban({ items, usersById, onOpen }: Props) {
  return (
    <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2, alignItems: "flex-start" }}>
      {STAGES.map((stage) => {
        const col = items.filter((d) => d.workflow.stage === stage.id);
        const total = col.reduce((s, d) => s + (d.requestedAmount?.amount ?? 0), 0);
        return (
          <Box
            key={stage.id}
            sx={{ width: 290, flexShrink: 0, bgcolor: "action.hover", borderRadius: 2, p: 1.25 }}
          >
            <Stack
              direction="row"

              sx={{ px: 0.5, pb: 1, alignItems: "center", justifyContent: "space-between" }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: stage.color }} />
                <Typography variant="subtitle2">{stage.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {col.length}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatMoney({ amount: total, currency: "USD" })}
              </Typography>
            </Stack>

            <Stack spacing={1}>
              {col.map((d) => (
                <Card key={d.id} sx={{ bgcolor: "background.paper" }}>
                  <CardActionArea onClick={() => onOpen(d.id)}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography sx={{ fontWeight: 600 }} variant="body2">
                        {d.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: "block" }}
                      >
                        {d.borrowerName}
                      </Typography>
                      <Stack
                        direction="row"

                        sx={{ mt: 1, justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatMoney(d.requestedAmount)}
                        </Typography>
                        <RiskChip level={d.riskLevel} />
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={d.diligenceReadiness}
                        sx={{ height: 5, borderRadius: 3, mt: 1.25 }}
                      />
                      <Stack
                        direction="row"

                        sx={{ mt: 1, justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {humanize(d.workflow.status)}
                          {d.nextIcDate ? ` · IC ${formatDate(d.nextIcDate)}` : ""}
                        </Typography>
                        <OwnerAvatar name={usersById[d.ownerId]?.name} size={22} />
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
