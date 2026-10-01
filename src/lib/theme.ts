"use client";
import { createTheme } from "@mui/material/styles";

export const SIDEBAR_BG = "#0f1f3d";
export const SIDEBAR_WIDTH = 232;

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: "#1d6ef2" },
    success: { main: "#16a34a", light: "#dcfce7" },
    error: { main: "#dc2626", light: "#fee2e2" },
    warning: { main: "#d97706", light: "#fef3c7" },
    background: { default: "#f4f6fb", paper: "#ffffff" },
    text: { primary: "#0f1f3d", secondary: "#64748b" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: "1px solid #e5e9f2" } },
    },
    MuiAppBar: { styleOverrides: { root: { border: "none" } } },
    MuiDrawer: { styleOverrides: { paper: { border: "none" } } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: "#475569", backgroundColor: "#f8fafc", fontSize: 13 },
        root: { borderColor: "#eef1f6" },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});
