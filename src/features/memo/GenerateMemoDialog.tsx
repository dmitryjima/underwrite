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
  Stack,
  Typography,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import RadioButtonUnchecked from "@mui/icons-material/RadioButtonUnchecked";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import { GENERATE_STEPS } from "../../api/memos";
import { api } from "../../api/client";
import { MEMO_TYPES } from "../../lib/memo-meta";
import type { TMemoType } from "../../types/memos";

interface Props {
  open: boolean;
  onClose: () => void;
  dealId: string;
  actorId: string;
  allowedTypes: TMemoType[];
  defaultType?: TMemoType;
  inputs: {
    documents: number;
    openFindings: number;
    pendingSuggestions: number;
    readiness: number;
  };
  onGenerated: (memoId: string) => void;
}

export default function GenerateMemoDialog({
  open,
  onClose,
  dealId,
  actorId,
  allowedTypes,
  defaultType,
  inputs,
  onGenerated,
}: Props) {
  const types = MEMO_TYPES.filter((t) => allowedTypes.includes(t.id));
  const [type, setType] = useState<TMemoType>(
    defaultType && allowedTypes.includes(defaultType)
      ? defaultType
      : (types[0]?.id ?? "preliminary"),
  );
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  const run = async () => {
    setRunning(true);
    setStep(0);
    setError("");
    try {
      const memo = await api.memos.generate({ dealId, type, actorId, onStep: setStep });
      onGenerated(memo.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Generate IC memo</DialogTitle>
      <DialogContent>
        {!running ? (
          <Stack sx={{ gap: 2, pt: 0.5 }}>
            <Stack sx={{ gap: 1 }}>
              {types.map((t) => (
                <Box
                  key={t.id}
                  onClick={() => setType(t.id)}
                  sx={{
                    p: 1.5,
                    border: 2,
                    borderRadius: 2,
                    cursor: "pointer",
                    borderColor: type === t.id ? "primary.main" : "divider",
                    bgcolor: type === t.id ? "action.hover" : "transparent",
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>{t.label}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {t.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                BUILT FROM THE CURRENT DEAL DATA
              </Typography>
              <Stack sx={{ flexDirection: "row", gap: 1, flexWrap: "wrap", mt: 0.75 }}>
                <Chip size="small" label={`${inputs.documents} documents`} />
                <Chip
                  size="small"
                  label={`${inputs.openFindings} open findings`}
                  color={inputs.openFindings ? "warning" : "default"}
                />
                <Chip size="small" label={`Readiness ${inputs.readiness}%`} />
                {inputs.pendingSuggestions > 0 && (
                  <Chip
                    size="small"
                    color="secondary"
                    icon={<AutoAwesome />}
                    label={`${inputs.pendingSuggestions} AI suggestion pending`}
                  />
                )}
              </Stack>
            </Box>
            {inputs.pendingSuggestions > 0 && (
              <Alert severity="info">
                A pending AI suggestion is <b>not</b> reflected in the memo until you accept it. The
                memo will note it as pending.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack sx={{ gap: 1.25, pt: 1 }}>
            {GENERATE_STEPS.map((label, i) => {
              const done = step > i;
              const active = step === i;
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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={running}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<AutoAwesome />}
          onClick={run}
          disabled={running || types.length === 0}
        >
          Generate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
