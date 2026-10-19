import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  type AutocompleteRenderGetTagProps,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import UploadFile from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router";
import { api, TEASER_STEPS, type CreateDealInput, type TeaserParseResult } from "../../api/client";
import {
  DEAL_TYPE_LABELS,
  REQUIRED_BY_STAGE,
  STAGES,
  STATUS_OPTIONS,
  humanize,
  type DealFormField,
} from "../../lib/deal-meta";
import { formatMoney } from "../../lib/format";
import { locationLabel } from "../../parsing/describe";
import type { Money } from "../../types/common";
import type { Cycle } from "../../types/cycles";
import type { TDealStage, TDealType, TDealWorkflow } from "../../types/deals";
import type { ExtractedField } from "../../types/documents";
import type { User } from "../../types/users";

interface Props {
  open: boolean;
  onClose: () => void;
  cycles: Cycle[];
  users: User[];
  currentUserId: string;
  defaultCycleId?: string;
}

interface FormState {
  name: string;
  borrowerName: string;
  description: string;
  stage: TDealStage;
  status: string;
  cycleId: string;
  ownerId: string;
  dealType: TDealType | "";
  currency: string;
  requestedAmount: string;
  proposedAmount: string;
  industry: string;
  location: string;
  websiteUrl: string;
  targetCloseDate: string;
  nextIcDate: string;
  tags: string[];
}

type TextKey = Exclude<keyof FormState, "tags">;

const initial = (ownerId: string, cycleId = ""): FormState => ({
  name: "",
  borrowerName: "",
  description: "",
  stage: "teaser_evaluation",
  status: "new",
  cycleId,
  ownerId,
  dealType: "",
  currency: "USD",
  requestedAmount: "",
  proposedAmount: "",
  industry: "",
  location: "",
  websiteUrl: "",
  targetCloseDate: "",
  nextIcDate: "",
  tags: [],
});

const toMoney = (v: string, currency: string): Money | undefined =>
  v.trim() && !Number.isNaN(Number(v))
    ? { amount: Math.round(Number(v) * 1e6), currency }
    : undefined;
const orUndef = (v: string) => (v.trim() ? v.trim() : undefined);

export default function NewDealDialog({
  open,
  onClose,
  cycles,
  users,
  currentUserId,
  defaultCycleId,
}: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => initial(currentUserId, defaultCycleId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [teaser, setTeaser] = useState<TeaserParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [step, setStep] = useState(0);
  const [parseError, setParseError] = useState("");
  const [saving, setSaving] = useState(false);

  const required = REQUIRED_BY_STAGE[form.stage];
  const isReq = (k: string) => required.includes(k as DealFormField);
  const prefilled: Record<string, ExtractedField> = teaser?.fields ?? {};

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const setStage = (stage: TDealStage) => {
    setForm((f) => ({ ...f, stage, status: STATUS_OPTIONS[stage][0] }));
    setErrors({});
  };

  const aiNote = (k: string) => {
    const f = prefilled[k];
    return f
      ? `AI · ${locationLabel(f.sourceLocation) ?? "teaser"} · ${Math.round((f.confidence ?? 0) * 100)}%`
      : undefined;
  };

  const handleClose = () => {
    if (saving || parsing) return;
    onClose();
    setTimeout(() => {
      setForm(initial(currentUserId, defaultCycleId));
      setTeaser(null);
      setErrors({});
      setParseError("");
    }, 200);
  };

  const parseTeaser = async (file?: File) => {
    if (!file) return;
    setParsing(true);
    setParseError("");
    setStep(0);
    try {
      const res = await api.documents.parseTeaser(file, setStep);
      setTeaser(res);
      const v = (k: string) => res.fields[k]?.value;
      const amount = v("requestedAmount") as Money | undefined;
      setForm((f) => ({
        ...f,
        name: (v("name") as string) ?? f.name,
        borrowerName: (v("borrowerName") as string) ?? f.borrowerName,
        industry: (v("industry") as string) ?? f.industry,
        location: (v("location") as string) ?? f.location,
        websiteUrl: (v("websiteUrl") as string) ?? f.websiteUrl,
        description: (v("description") as string) ?? f.description,
        dealType: (v("dealType") as TDealType) ?? f.dealType,
        targetCloseDate: (v("targetCloseDate") as string) ?? f.targetCloseDate,
        currency: amount?.currency ?? f.currency,
        requestedAmount: amount ? String(amount.amount / 1e6) : f.requestedAmount,
      }));
      setErrors({});
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read this file");
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const k of required) {
      if (!String(form[k as TextKey] ?? "").trim()) errs[k] = "Required at this stage";
    }
    if (form.requestedAmount && !toMoney(form.requestedAmount, form.currency))
      errs.requestedAmount = "Enter a number (in millions)";
    if (form.proposedAmount && !toMoney(form.proposedAmount, form.currency))
      errs.proposedAmount = "Enter a number (in millions)";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input: CreateDealInput = {
      name: form.name.trim(),
      borrowerName: form.borrowerName.trim(),
      workflow: { stage: form.stage, status: form.status } as TDealWorkflow,
      ownerId: form.ownerId,
      description: orUndef(form.description),
      cycleId: orUndef(form.cycleId),
      dealType: form.dealType || undefined,
      requestedAmount: toMoney(form.requestedAmount, form.currency),
      proposedAmount: toMoney(form.proposedAmount, form.currency),
      industry: orUndef(form.industry),
      location: orUndef(form.location),
      websiteUrl: orUndef(form.websiteUrl),
      targetCloseDate: orUndef(form.targetCloseDate),
      nextIcDate: orUndef(form.nextIcDate),
      tags: form.tags,
    };
    setSaving(true);
    try {
      const deal = await api.deals.create(
        input,
        currentUserId,
        teaser ? { file: teaser.file, fields: teaser.fields } : undefined,
      );
      onClose();
      navigate(`/deals/${deal.id}`);
    } finally {
      setSaving(false);
    }
  };

  /** One field renderer for every input: required marker, AI badge, error / provenance helper text. */
  const field = (
    key: TextKey,
    label: string,
    opts: {
      type?: string;
      multiline?: boolean;
      span?: boolean;
      options?: React.ReactNode;
      required?: boolean;
    } = {},
  ) => (
    <TextField
      size="small"
      fullWidth
      select={!!opts.options}
      type={opts.type}
      multiline={opts.multiline}
      minRows={opts.multiline ? 3 : undefined}
      label={`${label}${(opts.required ?? isReq(key)) ? " *" : ""}`}
      value={form[key]}
      onChange={(e) => set(key, e.target.value as never)}
      error={!!errors[key]}
      helperText={errors[key] || aiNote(key)}
      sx={{ gridColumn: opts.span ? "1 / -1" : undefined }}
      slotProps={{
        inputLabel: opts.type === "date" ? { shrink: true } : undefined,
        input: {
          startAdornment: prefilled[key] ? (
            <AutoAwesome fontSize="small" color="secondary" sx={{ mr: 1 }} />
          ) : undefined,
        },
      }}
    >
      {opts.options}
    </TextField>
  );

  const grid = { display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>New deal</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2.5, pt: 1 }}>
          {/* Teaser dropzone */}
          <Box
            component="label"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              parseTeaser(e.dataTransfer.files[0]);
            }}
            sx={{
              display: "block",
              border: "2px dashed",
              borderRadius: 2,
              p: 2.5,
              bgcolor: "action.hover",
              borderColor: teaser ? "success.main" : "divider",
              cursor: parsing ? "default" : "pointer",
            }}
          >
            <input
              hidden
              type="file"
              accept=".pdf"
              disabled={parsing}
              onChange={(e) => parseTeaser(e.target.files?.[0])}
            />
            <Stack sx={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
              {parsing ? (
                <CircularProgress size={28} />
              ) : (
                <UploadFile sx={{ fontSize: 32, color: "text.secondary" }} />
              )}
              <Box>
                <Typography sx={{ fontWeight: 600 }}>
                  {parsing
                    ? `${TEASER_STEPS[Math.min(step, TEASER_STEPS.length - 1)]}…`
                    : teaser
                      ? teaser.file.name
                      : "Upload a teaser (PDF) to prefill the form"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {teaser
                    ? "Drop another file to replace it"
                    : "Or fill in the fields manually below"}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {parseError && <Alert severity="error">{parseError}</Alert>}
          {teaser && (
            <Alert severity="success" icon={<AutoAwesome fontSize="inherit" />}>
              Prefilled {teaser.summary.length} fields from the teaser. Review before saving.
              {teaser.ltmRevenue && teaser.ltmEbitda
                ? ` LTM revenue ${formatMoney(teaser.ltmRevenue)}, EBITDA ${formatMoney(teaser.ltmEbitda)} — these will be used for the financial analysis block later.`
                : ""}
            </Alert>
          )}

          {/* Workflow */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Pipeline
            </Typography>
            <Box sx={{ ...grid, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
              <TextField
                select
                size="small"
                label="Stage"
                value={form.stage}
                onChange={(e) => setStage(e.target.value as TDealStage)}
              >
                {STAGES.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS[form.stage].map((s) => (
                  <MenuItem key={s} value={s}>
                    {humanize(s)}
                  </MenuItem>
                ))}
              </TextField>
              {field("cycleId", "Cycle", {
                options: [
                  <MenuItem key="" value="">
                    Unassigned
                  </MenuItem>,
                  ...cycles
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    )),
                ],
              })}
              {field("ownerId", "Owner", {
                options: users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                )),
              })}
            </Box>
            {required.length > 3 && (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block", mt: 1 }}
              >
                At “{STAGES.find((s) => s.id === form.stage)!.label}” these fields are required:{" "}
                {required
                  .map((k) =>
                    humanize(
                      k
                        .replace(/Id$/, "")
                        .replace(/([A-Z])/g, " $1")
                        .toLowerCase(),
                    ),
                  )
                  .join(", ")}
                .
              </Typography>
            )}
          </Box>

          {/* Basics */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Deal
            </Typography>
            <Box sx={grid}>
              {field("name", "Deal name")}
              {field("borrowerName", "Borrower")}
              {field("industry", "Industry")}
              {field("location", "Location")}
              {field("websiteUrl", "Website")}
              {field("dealType", "Deal type", {
                options: [
                  <MenuItem key="" value="">
                    —
                  </MenuItem>,
                  ...Object.entries(DEAL_TYPE_LABELS).map(([id, label]) => (
                    <MenuItem key={id} value={id}>
                      {label}
                    </MenuItem>
                  )),
                ],
              })}
              {field("description", "Description", { multiline: true, span: true })}
            </Box>
          </Box>

          {/* Money and dates */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Amounts and dates
            </Typography>
            <Box sx={{ ...grid, gridTemplateColumns: { xs: "1fr", sm: "120px 1fr 1fr" } }}>
              <TextField
                select
                size="small"
                label="Currency"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {["USD", "EUR", "GBP"].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              {field("requestedAmount", "Requested (millions)")}
              {field("proposedAmount", "Proposed (millions)")}
            </Box>
            <Box sx={{ ...grid, mt: 2 }}>
              {field("targetCloseDate", "Target close date", { type: "date" })}
              {field("nextIcDate", "Next IC date", { type: "date" })}
            </Box>
          </Box>

          <Autocomplete
            multiple={true}
            freeSolo
            size="small"
            options={[] as string[]}
            value={form.tags}
            onChange={(_, v) => set("tags", v)}
            renderValue={(value, getItemProps) =>
              value.map((tag, index) => (
                <Chip
                  size="small"
                  label={tag}
                  {...getItemProps({ index })}
                  key={`${tag}-${index}`}
                />
              ))
            }
            renderInput={(p) => (
              <TextField {...p} label="Tags" placeholder="Type and press Enter" />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving || parsing}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving || parsing}>
          {saving ? "Creating…" : "Create deal"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
