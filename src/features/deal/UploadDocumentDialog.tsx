import { useState } from "react";
import {
  Alert,
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
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import RadioButtonUnchecked from "@mui/icons-material/RadioButtonUnchecked";
import UploadFile from "@mui/icons-material/UploadFile";
import { api, UPLOAD_STEPS, type UploadResult } from "../../api/client";
import { ACCEPTED_EXT, DOC_TYPE_OPTIONS, guessDocType } from "../../lib/documents";
import type { TDocumentType } from "../../types/documents";

interface Props {
  open: boolean;
  onClose: () => void;
  dealId: string;
  actorId: string;
  defaultType?: TDocumentType;
  /** Called as soon as the server-side work is done, so the page behind can refresh. */
  onDone: () => void;
  onReview?: () => void;
}

export default function UploadDocumentDialog({
  open,
  onClose,
  dealId,
  actorId,
  defaultType,
  onDone,
  onReview,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<TDocumentType>(defaultType ?? "other");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setPhase("idle");
    setStep(0);
    setResult(null);
    setError("");
    setType(defaultType ?? "other");
  };
  const close = () => {
    if (phase !== "running") {
      onClose();
      setTimeout(reset, 200);
    }
  };

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f);
    const guess = guessDocType(f.name);
    setType(guess !== "other" ? guess : (defaultType ?? "other"));
  };

  const run = async () => {
    if (!file) return;
    setPhase("running");
    setStep(0);
    try {
      const res = await api.documents.upload({ dealId, file, type, actorId, onStep: setStep });
      setResult(res);
      setPhase("done");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("error");
    }
  };

  const hasSuggestion = result?.adjustment?.status === "proposed";

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Upload document</DialogTitle>
      <DialogContent>
        {phase === "idle" && (
          <Stack sx={{ gap: 2, pt: 1 }}>
            <Box
              component="label"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files[0]);
              }}
              sx={{
                border: "2px dashed",
                borderColor: file ? "primary.main" : "divider",
                borderRadius: 2,
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: "action.hover",
                display: "block",
              }}
            >
              <input
                hidden
                type="file"
                accept={ACCEPTED_EXT}
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <UploadFile sx={{ fontSize: 36, color: "text.secondary" }} />
              <Typography sx={{ fontWeight: 600 }}>
                {file ? file.name : "Drop a file or click to browse"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                PDF, XLSX or DOCX
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Document type"
              value={type}
              onChange={(e) => setType(e.target.value as TDocumentType)}
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}

        {(phase === "running" || phase === "done") && (
          <Stack sx={{ gap: 1.25, pt: 1 }}>
            {UPLOAD_STEPS.map((label, i) => {
              const done = step > i || phase === "done";
              const active = step === i && phase === "running";
              return (
                <Stack
                  key={label}
                  sx={{
                    flexDirection: "row",
                    gap: 1.5,
                    alignItems: "center",
                    opacity: done || active ? 1 : 0.45,
                  }}
                >
                  {done ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : active ? (
                    <CircularProgress size={18} />
                  ) : (
                    <RadioButtonUnchecked fontSize="small" />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: active ? 700 : 400 }}>
                    {label}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}

        {phase === "done" && result && (
          <Stack sx={{ gap: 2, mt: 2.5 }}>
            <Alert severity={result.document.processingStatus === "failed" ? "warning" : "success"}>
              {result.message}
            </Alert>
            {hasSuggestion && (
              <Alert
                severity="warning"
                action={
                  onReview && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        onReview();
                        close();
                      }}
                    >
                      Review
                    </Button>
                  )
                }
              >
                AI found a discrepancy with the financing report and prepared a suggested
                adjustment.
              </Alert>
            )}
            {result.summary.length > 0 && (
              <Box
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {result.summary.map((s) => (
                  <Stack
                    key={s.key}
                    sx={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 2,
                      px: 1.5,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:last-child": { borderBottom: 0 },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.label}
                      </Typography>
                      {s.location && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {s.location}
                        </Typography>
                      )}
                    </Box>
                    <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                      <Typography variant="body2">{s.value}</Typography>
                      {s.confidence !== undefined && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${Math.round(s.confidence * 100)}%`}
                        />
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Box>
            )}
          </Stack>
        )}

        {phase === "error" && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {phase === "idle" && (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" disabled={!file} onClick={run}>
              Upload &amp; analyse
            </Button>
          </>
        )}
        {phase === "running" && <Button disabled>Processing…</Button>}
        {phase === "done" && (
          <Button variant="contained" onClick={close}>
            Close
          </Button>
        )}
        {phase === "error" && (
          <>
            <Button onClick={close}>Close</Button>
            <Button variant="contained" onClick={() => setPhase("idle")}>
              Try again
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
