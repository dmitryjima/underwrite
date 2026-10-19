import { useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Link as MuiLink,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Download from "@mui/icons-material/Download";
import EditOutlined from "@mui/icons-material/EditOutlined";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import type { appLoader, memoLoader } from "../routes/loaders";
import { api } from "../api/client";
import GenerateMemoDialog from "../features/memo/GenerateMemoDialog";
import SectionEditor from "../features/memo/SectionEditor";
import { memoBodySx } from "../features/memo/memoBodySx";
import {
  MEMO_STATUS_META,
  MEMO_TRANSITIONS,
  MEMO_TYPES,
  MEMO_TYPE_LABEL,
  isEditable,
  memoArea,
} from "../lib/memo-meta";
import { AI_ACTOR_NAME } from "../lib/deal-meta";
import { formatDateTime } from "../lib/format";
import { can } from "../lib/permissions";
import { buildDocModel } from "../memo/blocks";
import { downloadBlob } from "../memo/download";
import { downloadPdf } from "../memo/exportPdf";

export default function MemoPage() {
  const { deal, cycle, memos, revision, inputs, users } = useLoaderData<typeof memoLoader>();
  const me = useRouteLoaderData<typeof appLoader>("app")!;
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ text: string; error?: boolean } | null>(null);

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const visible = memos.filter((m) => can(me.role, memoArea(m.type)));
  const selected =
    visible.find((m) => m.id === params.get("v")) ??
    visible.find((m) => m.status !== "superseded") ??
    visible[0];
  const writableTypes = MEMO_TYPES.map((t) => t.id).filter((t) =>
    can(me.role, memoArea(t), "write"),
  );

  const canEdit =
    !!selected && can(me.role, memoArea(selected.type), "write") && isEditable(selected.status);
  const stale =
    !!selected && selected.status !== "superseded" && selected.sourceRevision < revision;
  const canFinalWrite = can(me.role, "deal_ic_memo_final", "write");
  const transitions = (selected ? (MEMO_TRANSITIONS[selected.status] ?? []) : []).filter((t) =>
    t.needsFinalWrite ? canFinalWrite : can(me.role, memoArea(selected!.type), "write"),
  );

  const fail = (e: unknown) =>
    setSnack({ text: e instanceof Error ? e.message : "Something went wrong", error: true });

  const saveSection = async (sectionId: string, html: string) => {
    try {
      await api.memos.updateSection(selected!.id, sectionId, html, me.user.id);
      setEditing(null);
      revalidator.revalidate();
      setSnack({ text: "Section saved" });
    } catch (e) {
      fail(e);
    }
  };

  const move = async (to: Parameters<typeof api.memos.setStatus>[1]) => {
    setBusy(true);
    try {
      await api.memos.setStatus(selected!.id, to, me.user.id);
      setEditing(null);
      revalidator.revalidate();
      setSnack({
        text: to === "approved" ? "Memo approved" : `Status: ${MEMO_STATUS_META[to].label}`,
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (kind: "docx" | "pdf") => {
    setExportAnchor(null);
    if (!selected) return;
    setExporting(true);

    try {
      const model = buildDocModel(selected, {
        dealName: deal.name,
        borrower: deal.borrowerName,
        cycle: cycle?.name,
        owner: usersById[deal.ownerId]?.name,
      });

      if (kind === "docx") {
        const { buildDocx } = await import("../memo/exportDocx");
        downloadBlob(await buildDocx(model), `${model.fileName}.docx`);
      } else {
        await downloadPdf(model);
      }
    } catch (e) {
      fail(e);
    } finally {
      setExporting(false);
    }
  };

  const generatedBy = selected?.generatedBy ? usersById[selected.generatedBy]?.name : undefined;

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
        <MuiLink component={Link} to={`/deals/${deal.id}`} underline="hover" color="inherit">
          {deal.name}
        </MuiLink>
        <Typography sx={{ color: "text.primary" }}>IC memo</Typography>
      </Breadcrumbs>

      <Stack
        sx={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h5">IC memo</Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {deal.name} · {deal.borrowerName}
          </Typography>
        </Box>
        {writableTypes.length > 0 && (
          <Button
            variant="contained"
            startIcon={<AutoAwesome />}
            onClick={() => setGenerateOpen(true)}
          >
            {visible.length ? "Generate new version" : "Generate memo"}
          </Button>
        )}
      </Stack>

      {!selected ? (
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 600 }}>No IC memo yet</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {writableTypes.length
                ? "Generate a first version from the current deal data. You can edit every section afterwards and export it to Word or PDF."
                : "Nobody has generated a memo for this deal, and your role cannot generate one."}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", lg: "250px minmax(0, 1fr)" },
            alignItems: "start",
          }}
        >
          {/* Versions */}
          <Stack sx={{ gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              VERSIONS
            </Typography>
            {visible.map((m) => {
              const sm = MEMO_STATUS_META[m.status];
              const isSel = m.id === selected.id;
              return (
                <Card
                  key={m.id}
                  sx={{
                    borderColor: isSel ? "primary.main" : "divider",
                    borderWidth: isSel ? 2 : 1,
                    opacity: m.status === "superseded" ? 0.65 : 1,
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      setEditing(null);
                      setParams({ v: m.id });
                    }}
                  >
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack
                        sx={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>
                          v{m.version} · {MEMO_TYPE_LABEL[m.type]}
                        </Typography>
                        <Chip size="small" label={sm.label} color={sm.color} />
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        {formatDateTime(m.generatedAt ?? m.createdAt)}
                      </Typography>
                      {m.status !== "superseded" && m.sourceRevision < revision && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label="Data changed"
                          sx={{ mt: 0.75 }}
                        />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>

          {/* Document */}
          <Stack sx={{ gap: 2, minWidth: 0 }}>
            <Card>
              <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                <Stack
                  sx={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Stack
                    sx={{ flexDirection: "row", gap: 1, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>Version {selected.version}</Typography>
                    <Chip size="small" label={MEMO_TYPE_LABEL[selected.type]} variant="outlined" />
                    <Chip
                      size="small"
                      label={MEMO_STATUS_META[selected.status].label}
                      color={MEMO_STATUS_META[selected.status].color}
                    />
                    {!canEdit && selected.status !== "superseded" && (
                      <Chip size="small" variant="outlined" label="Read-only" />
                    )}
                  </Stack>
                  <Stack sx={{ flexDirection: "row", gap: 1, flexWrap: "wrap" }}>
                    {transitions.map((t) => (
                      <Button
                        key={t.to}
                        size="small"
                        variant={t.primary ? "contained" : "outlined"}
                        color={t.to === "approved" ? "success" : "primary"}
                        disabled={busy}
                        onClick={() => move(t.to)}
                      >
                        {t.label}
                      </Button>
                    ))}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Download />}
                      disabled={exporting}
                      onClick={(e) => setExportAnchor(e.currentTarget)}
                    >
                      {exporting ? "Preparing…" : "Export"}
                    </Button>
                    <Menu
                      anchorEl={exportAnchor}
                      open={!!exportAnchor}
                      onClose={() => setExportAnchor(null)}
                    >
                      <MenuItem onClick={() => doExport("docx")}>Word (.docx)</MenuItem>
                      <MenuItem onClick={() => doExport("pdf")}>PDF</MenuItem>
                    </Menu>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {stale && (
              <Alert
                severity="warning"
                action={
                  writableTypes.includes(selected.type) && (
                    <Button color="inherit" size="small" onClick={() => setGenerateOpen(true)}>
                      Generate updated version
                    </Button>
                  )
                }
              >
                The deal data has changed since this version was generated (a document, finding or
                adjustment). Figures and the recommendation may be out of date. Manual edits are not
                carried over to a new version.
              </Alert>
            )}

            <Box
              sx={{
                bgcolor: "#fff",
                boxShadow: 3,
                borderRadius: 1,
                maxWidth: 880,
                width: "100%",
                mx: "auto",
                px: { xs: 2.5, md: 7 },
                py: { xs: 3, md: 6 },
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  color: "primary.dark",
                  lineHeight: 1.2,
                }}
              >
                {selected.title}
              </Typography>
              <Typography sx={{ color: "text.secondary", mt: 0.75 }}>
                Investment Committee memorandum · Version {selected.version}
                {cycle ? ` · ${cycle.name}` : ""}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block", mt: 0.5, mb: 3 }}
              >
                Drafted by {AI_ACTOR_NAME}
                {generatedBy ? `, requested by ${generatedBy}` : ""} ·{" "}
                {formatDateTime(selected.generatedAt ?? selected.createdAt)} · data snapshot r
                {selected.sourceRevision}
                {selected.approvedAt
                  ? ` · Approved ${formatDateTime(selected.approvedAt)} by ${usersById[selected.approvedBy ?? ""]?.name ?? "—"}`
                  : ""}
              </Typography>

              {selected.sections.map((s, i) => (
                <Box key={s.id} sx={{ mb: 3.5, "&:hover .edit-btn": { opacity: 1 } }}>
                  <Stack
                    sx={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottom: 1,
                      borderColor: "divider",
                      pb: 0.5,
                      mb: 1.5,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                      {i + 1}. {s.title}
                    </Typography>
                    {canEdit && editing !== s.id && (
                      <Button
                        className="edit-btn"
                        size="small"
                        startIcon={<EditOutlined />}
                        onClick={() => setEditing(s.id)}
                        sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity .15s" }}
                      >
                        Edit
                      </Button>
                    )}
                  </Stack>
                  {editing === s.id ? (
                    <SectionEditor
                      html={s.content}
                      onSave={(html) => saveSection(s.id, html)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <Box sx={memoBodySx} dangerouslySetInnerHTML={{ __html: s.content }} />
                  )}
                </Box>
              ))}
            </Box>
          </Stack>
        </Box>
      )}

      <GenerateMemoDialog
        key={`${generateOpen}-${selected?.type ?? "x"}`}
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        dealId={deal.id}
        actorId={me.user.id}
        allowedTypes={writableTypes}
        defaultType={selected?.type}
        inputs={inputs}
        onGenerated={(id) => {
          setParams({ v: id });
          revalidator.revalidate();
        }}
      />

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack(null)}>
        <Alert
          severity={snack?.error ? "error" : "success"}
          variant="filled"
          onClose={() => setSnack(null)}
        >
          {snack?.text}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
