import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    primary: { main: "#2f4845" },
    background: { default: "#f7f7f4" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, color: "#5b6478" } } },
  },
});
