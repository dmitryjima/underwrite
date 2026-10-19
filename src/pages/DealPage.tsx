import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Link as MuiLink,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import UploadFile from "@mui/icons-material/UploadFile";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import type { appLoader, dealLoader } from "../routes/loaders";
import { api } from "../api/client";
import OwnerAvatar from "../components/OwnerAvatar";
import { RiskChip, StageChip } from "../components/chips";
import AdjustmentCard from "../features/deal/AdjustmentCard";
import DiligenceBlockCard from "../features/deal/DiligenceBlockCard";
import RiskOverview from "../features/deal/RiskOverview";

import UploadDocumentDialog from "../features/deal/UploadDocumentDialog";
import { AI_ACTOR_ID, AI_ACTOR_NAME, DEAL_TYPE_LABELS, STAGES, humanize } from "../lib/deal-meta";
import { formatDate, formatDateTime, formatMoney } from "../lib/format";
import { can } from "../lib/permissions";
import type { TDocumentType } from "../types/documents";
import type { TPermissionArea } from "../types/users";
import { historyBundle, parseRange, RANGES, type HistoryRange } from "../lib/history";
import { deriveRiskOverview } from "../lib/risks";

const TABS: { id: string; label: string; area: TPermissionArea }[] = [
  { id: "overview", label: "Overview", area: "deal_details" },
  { id: "securities", label: "Securities", area: "deal_securities" },
  { id: "diligence", label: "Due diligence", area: "deal_due_diligence" },
  { id: "documents", label: "Documents", area: "deal_documents" },
  { id: "findings", label: "Findings", area: "deal_findings" },
  { id: "activity", label: "Activity", area: "deal_details" },
];

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box>
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {value ?? "—"}
    </Typography>
  </Box>
);

export default function DealPage() {
  const { deal, cycle, securities, blocks, documents, findings, adjustments, activity, users } =
    useLoaderData<typeof dealLoader>();
  const me = useRouteLoaderData<typeof appLoader>("app")!;
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const [uploadType, setUploadType] = useState<TDocumentType | null>(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState("");
  const [snackError, setSnackError] = useState(false);

  const range = parseRange(params.get("range"));
  const history = useMemo(() => historyBundle(deal, blocks), [deal, blocks]);
  const risks = useMemo(
    () => deriveRiskOverview({ deal, securities, blocks, findings, adjustments }),
    [deal, securities, blocks, findings, adjustments],
  );
  const setRange = (r: HistoryRange) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (r === "latest") n.delete("range");
        else n.set("range", r);
        return n;
      },
      { replace: true },
    );

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const actorName = (id: string) => (id === AI_ACTOR_ID ? AI_ACTOR_NAME : usersById[id]?.name);

  const tabs = TABS.filter((t) => can(me.role, t.area));
  const tab = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab")! : tabs[0]?.id;
  const goTab = (id: string) => setParams({ tab: id });
  const stageIdx = STAGES.findIndex((s) => s.id === deal.workflow.stage);
  const openFindings = findings.filter((f) => f.status === "open" || f.status === "under_review");

  const pending = adjustments.filter((a) => a.status === "proposed");
  const decided = adjustments.filter((a) => a.status === "accepted" || a.status === "rejected");
  const canDecide = can(me.role, "deal_findings", "write");
  const canUpload = can(me.role, "deal_documents", "write");

  const decide = async (id: string, decision: "accepted" | "rejected", comment?: string) => {
    setBusy(true);
    try {
      const { adjustment } = await api.adjustments.decide(id, decision, me.user.id, comment);
      setSnackError(false);
      setSnack(
        decision === "accepted"
          ? `Adjustment accepted. Deal risk updated: ${humanize(adjustment.riskBefore)} → ${humanize(adjustment.riskAfter)}.`
          : "Suggestion declined. The original figures are kept.",
      );
      revalidator.revalidate();
    } catch (e) {
      setSnackError(true);
      setSnack(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = (
    <Stack sx={{ gap: 2 }}>
      {pending.map((a) => (
        <AdjustmentCard
          key={a.id}
          adjustment={a}
          canDecide={canDecide}
          busy={busy}
          onDecide={(d, c) => decide(a.id, d, c)}
        />
      ))}
    </Stack>
  );

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Breadcrumbs>
        <MuiLink
          component={Link}
          to={`/deals/dashboard?cycle=${deal.cycleId ?? "none"}`}
          underline="hover"
          color="inherit"
        >
          Deals
        </MuiLink>
        <Typography sx={{ color: "text.primary" }}>{deal.name}</Typography>
      </Breadcrumbs>

      <Stack
        sx={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5">{deal.name}</Typography>
          <Typography sx={{ color: "text.secondary" }}>{deal.borrowerName}</Typography>
        </Box>
        <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
          {cycle && <Chip size="small" variant="outlined" label={cycle.name} />}
          <StageChip workflow={deal.workflow} />
          {(can(me.role, "deal_ic_memo_preliminary") || can(me.role, "deal_ic_memo_final")) && (
            <Button size="small" variant="outlined" component={Link} to={`/deals/${deal.id}/memo`}>
              IC memo
            </Button>
          )}
          <RiskChip level={deal.riskLevel} />
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => goTab(v)}
        variant="scrollable"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={
              t.id === "findings" && openFindings.length
                ? `Findings (${openFindings.length})`
                : t.id === "diligence" && pending.length
                  ? `Due diligence (${pending.length} AI)`
                  : t.label
            }
          />
        ))}
      </Tabs>

      {tab === "overview" && (
        <Stack sx={{ gap: 2 }}>
          {pending.length > 0 && canDecide && suggestions}
          <Card>
            <CardContent sx={{ paddingBottom: "0.3rem !important" }}>
              <Stepper activeStep={stageIdx} alternativeLabel>
                {STAGES.filter(
                  (s) => s.id !== "declined" || deal.workflow.stage === "declined",
                ).map((s) => (
                  <Step key={s.id}>
                    <StepLabel>{s.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" } }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Key terms
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3,1fr)" },
                  }}
                >
                  <Fact
                    label="Deal type"
                    value={deal.dealType ? DEAL_TYPE_LABELS[deal.dealType] : undefined}
                  />
                  <Fact label="Requested" value={formatMoney(deal.requestedAmount, false)} />
                  <Fact label="Proposed" value={formatMoney(deal.proposedAmount, false)} />
                  <Fact label="Industry" value={deal.industry} />
                  <Fact label="Location" value={deal.location} />
                  <Fact label="Target close" value={formatDate(deal.targetCloseDate)} />
                  <Fact label="Next IC" value={formatDate(deal.nextIcDate)} />
                  <Fact label="Status" value={humanize(deal.workflow.status)} />
                </Box>
                {deal.description && (
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
                    {deal.description}
                  </Typography>
                )}
                <Stack sx={{ flexDirection: "row", gap: 0.5, mt: 2, flexWrap: "wrap" }}>
                  {deal.tags.map((t) => (
                    <Chip key={t} size="small" label={t} variant="outlined" />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Stack sx={{ gap: 2 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Diligence readiness
                  </Typography>
                  <Typography variant="h4" sx={{ my: 1, fontWeight: 700 }}>
                    {deal.diligenceReadiness}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={deal.diligenceReadiness}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    Team
                  </Typography>
                  <Stack sx={{ gap: 1 }}>
                    {[deal.ownerId, ...deal.teamMemberIds].map((id, i) => (
                      <Stack key={id} sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                        <OwnerAvatar name={usersById[id]?.name} />
                        <Typography variant="body2">{usersById[id]?.name}</Typography>
                        {i === 0 && <Chip size="small" label="Owner" />}
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {openFindings.length > 0 && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={() => goTab("findings")}>
                  View
                </Button>
              }
            >
              {openFindings.length} open finding{openFindings.length > 1 ? "s" : ""}:{" "}
              {openFindings.map((f) => f.title).join(" · ")}
            </Alert>
          )}
        </Stack>
      )}

      {tab === "securities" && (
        <Card>
          {securities.length === 0 ? (
            <CardContent>
              <Typography sx={{ color: "text.secondary" }}>
                No securities structured yet.
              </Typography>
            </CardContent>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Security</TableCell>
                  <TableCell>Seniority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Commitment</TableCell>
                  <TableCell>Pricing</TableCell>
                  <TableCell>Maturity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {securities.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {humanize(s.type)}
                      </Typography>
                    </TableCell>
                    <TableCell>{humanize(s.seniority)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={humanize(s.status)} />
                    </TableCell>
                    <TableCell align="right">{formatMoney(s.commitmentAmount, false)}</TableCell>
                    <TableCell>
                      {s.interestRate?.benchmark
                        ? `${s.interestRate.benchmark} + ${s.interestRate.spreadBps}bps`
                        : "—"}
                    </TableCell>
                    <TableCell>{formatDate(s.maturityDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "diligence" && (
        <Stack sx={{ gap: 2 }}>
          {suggestions}
          <Stack
            sx={{
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Analysis period
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={range}
              onChange={(_, v) => v && setRange(v)}
            >
              {RANGES.map((r) => (
                <ToggleButton key={r.id} value={r.id} sx={{ px: 1.5 }}>
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" },
            }}
          >
            {blocks.map((b) => (
              <DiligenceBlockCard
                key={b.id}
                block={b}
                range={range}
                history={history}
                canUpload={canUpload && can(me.role, "deal_due_diligence", "write")}
                onUpload={setUploadType}
              />
            ))}
          </Box>
          <RiskOverview rows={risks} />
          {decided.length > 0 && (
            <Stack sx={{ gap: 1 }}>
              <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 700 }}>
                AI SUGGESTION HISTORY
              </Typography>
              {decided.map((a) => (
                <AdjustmentCard
                  key={a.id}
                  adjustment={a}
                  canDecide={false}
                  busy={false}
                  decidedByName={actorName(a.decidedBy ?? "")}
                  onDecide={() => {}}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "documents" && (
        <Stack sx={{ gap: 2 }}>
          {canUpload && (
            <Box>
              <Button
                variant="contained"
                startIcon={<UploadFile />}
                onClick={() => setUploadType("other")}
              >
                Upload document
              </Button>
            </Box>
          )}
          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Processing</TableCell>
                  <TableCell align="right">Extracted</TableCell>
                  <TableCell>Uploaded</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{humanize(d.type)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={humanize(d.processingStatus)}
                        color={
                          d.processingStatus === "parsed"
                            ? "success"
                            : d.processingStatus === "failed"
                              ? "error"
                              : "default"
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      {d.extractedFields ? `${Object.keys(d.extractedFields).length} fields` : "—"}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(d.uploadedAt)} · {usersById[d.uploadedBy]?.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Stack>
      )}

      {tab === "findings" && (
        <Stack sx={{ gap: 1.5 }}>
          {findings.length === 0 && (
            <Typography sx={{ color: "text.secondary" }}>No findings.</Typography>
          )}
          {findings.map((f) => (
            <Card key={f.id}>
              <CardContent>
                <Stack
                  sx={{
                    flexDirection: "row",
                    gap: 1,
                    alignItems: "center",
                    flexWrap: "wrap",
                    mb: 0.5,
                  }}
                >
                  <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                  <RiskChip level={f.severity} />
                  <Chip size="small" variant="outlined" label={humanize(f.source)} />
                  <Chip
                    size="small"
                    label={humanize(f.status)}
                    color={
                      f.status === "resolved" || f.status === "accepted"
                        ? "success"
                        : f.status === "open"
                          ? "warning"
                          : "default"
                    }
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {f.description}
                </Typography>
                {f.reviewerComment && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Reviewer: “{f.reviewerComment}”
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {tab === "activity" && (
        <Card>
          <CardContent>
            <Stack sx={{ gap: 1.5 }}>
              {activity.map((a) => (
                <Stack key={a.id} sx={{ flexDirection: "row", gap: 1.5, alignItems: "center" }}>
                  <OwnerAvatar name={actorName(a.actorId)} size={24} />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {a.summary}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {formatDateTime(a.timestamp)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <UploadDocumentDialog
        key={uploadType ?? "closed"}
        open={!!uploadType}
        onClose={() => setUploadType(null)}
        dealId={deal.id}
        actorId={me.user.id}
        defaultType={uploadType ?? undefined}
        onDone={() => revalidator.revalidate()}
        onReview={() => goTab("diligence")}
      />

      <Snackbar open={!!snack} autoHideDuration={6000} onClose={() => setSnack("")}>
        <Alert
          severity={snackError ? "error" : "success"}
          variant="filled"
          onClose={() => setSnack("")}
        >
          {snack}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
