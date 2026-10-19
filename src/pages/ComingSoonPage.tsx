import { Typography } from "@mui/material";

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <Typography variant="h5">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Coming soon.
      </Typography>
    </>
  );
}
