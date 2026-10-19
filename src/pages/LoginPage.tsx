import { Box, Button, Card, CardContent, Chip, Container, Stack, Typography } from "@mui/material";
import { Form, useLoaderData, useNavigation } from "react-router";
import type { loginLoader } from "../routes/loaders";
import { api } from "../api/client";
import { initials } from "../lib/format";
import logoUrl from "../assets/logo.svg";

export default function LoginPage() {
  const { personas } = useLoaderData<typeof loginLoader>();
  const nav = useNavigation();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        py: 6,
        background: "linear-gradient(160deg,#eef2ff 0%,#f5f6fa 60%)",
      }}
    >
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
          <img
            src={logoUrl}
            width={32}
            height={32}
            style={{ marginRight: "0.5rem", position: "relative", top: "0.25rem" }}
          />
          Under
          <Box component="span" sx={{ color: "primary.main" }}>
            write
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
          Private credit deal flow, from teaser to IC memorandum. Choose a role to explore the demo.
        </Typography>

        <Box
          sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}
        >
          {personas.map(({ user, role, blurb }) => {
            const writes = role.permissions.filter((p) => p.accessLevel === "write").length;
            const reads = role.permissions.length - writes;
            return (
              <Card key={user.id} sx={{ display: "flex" }}>
                <CardContent
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1 }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                      }}
                    >
                      {initials(user.name)}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{user.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {role.name}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {blurb}
                  </Typography>
                  {/* <Stack direction="row" spacing={1}>
                    <Chip
                      size="small"
                      label={`${writes} write`}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip size="small" label={`${reads} read`} variant="outlined" />
                  </Stack> */}
                  <Form method="post">
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={nav.state !== "idle"}
                    >
                      Enter as {role.name}
                    </Button>
                  </Form>
                </CardContent>
              </Card>
            );
          })}
        </Box>

        <Button
          size="small"
          sx={{ mt: 3 }}
          color="inherit"
          onClick={() => {
            api.system.reset();
            window.location.reload();
          }}
        >
          Reset demo data
        </Button>
      </Container>
    </Box>
  );
}
