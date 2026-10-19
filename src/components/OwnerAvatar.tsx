import { Avatar, Tooltip } from "@mui/material";
import { AI_ACTOR_NAME } from "../lib/deal-meta";
import { initials } from "../lib/format";

export default function OwnerAvatar({ name, size = 26 }: { name?: string; size?: number }) {
  if (!name) return null;
  const ai = name === AI_ACTOR_NAME;
  return (
    <Tooltip title={name}>
      <Avatar
        sx={{
          width: size,
          height: size,
          fontSize: size * 0.42,
          bgcolor: ai ? "secondary.main" : "primary.main",
        }}
      >
        {ai ? "AI" : initials(name)}
      </Avatar>
    </Tooltip>
  );
}
