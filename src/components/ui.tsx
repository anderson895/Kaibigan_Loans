"use client";
import { Alert, Avatar, Box, Chip, CircularProgress, Paper, Stack, Typography, type ChipProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { LoanStatus, ScheduleStatus } from "@/domain/Loan";
import type { PaymentStatus } from "@/domain/Payment";

type AnyStatus = LoanStatus | ScheduleStatus | PaymentStatus;

const STATUS_STYLE: Record<AnyStatus, { label: string; bg: string; fg: string }> = {
  ongoing: { label: "On Going", bg: "#dcfce7", fg: "#15803d" },
  overdue: { label: "Overdue", bg: "#fee2e2", fg: "#b91c1c" },
  paid: { label: "Paid", bg: "#dbeafe", fg: "#1d4ed8" },
  pending: { label: "Pending", bg: "#fef3c7", fg: "#b45309" },
  partial: { label: "Partial", bg: "#e0e7ff", fg: "#4338ca" },
  rejected: { label: "Rejected", bg: "#f1f5f9", fg: "#475569" },
  approved: { label: "Approved", bg: "#dcfce7", fg: "#15803d" },
};

export function StatusChip({ status, label, ...rest }: { status: AnyStatus; label?: string } & Omit<ChipProps, "color">) {
  const style = STATUS_STYLE[status];
  return <Chip size="small" label={label ?? style.label} sx={{ bgcolor: style.bg, color: style.fg }} {...rest} />;
}

const AVATAR_COLORS = ["#8b5cf6", "#3b82f6", "#ec4899", "#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#6366f1"];

export function BorrowerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.42, bgcolor: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {name.charAt(0).toUpperCase()}
    </Avatar>
  );
}

export function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <BorrowerAvatar name={name} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {sub}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function StatCard({ icon, label, value, caption }: { icon: ReactNode; label: string; value: string; caption: string }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar sx={{ bgcolor: "#e8f0fe", color: "primary.main", width: 48, height: 48 }}>{icon}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5">{value}</Typography>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/** On phones the action goes under the title as a full-width button. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" }, mb: 3, gap: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: 24, md: 30 } }}>
          {title}
        </Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Box>
      {action && <Box sx={{ flexShrink: 0, "& > .MuiButton-root": { width: { xs: "100%", sm: "auto" } } }}>{action}</Box>}
    </Stack>
  );
}

/**
 * Phones: shows each table row as a card instead of a wide table that scrolls sideways. Put it on the
 * `TableContainer`. A cell's `data-label` is shown above its value, two cells per line. Cells without a
 * label (name, actions) and `data-wide` cells take the full line, `data-actions` cells stretch their
 * buttons, and `data-phone="hide"` cells are left out.
 */
export const cardsOnPhone = (theme: Theme) => ({
  [theme.breakpoints.down("sm")]: {
    "& thead": { display: "none" },
    "& table": { display: "block" },
    "& tbody": { display: "grid", gap: 1.5 },
    "& tbody tr": {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "12px 16px",
      p: 2,
      border: "1px solid #e5e9f2",
      borderRadius: 1,
    },
    "& tbody td": { display: "block", minWidth: 0, p: 0, border: 0, textAlign: "left", overflowWrap: "anywhere" },
    "& tbody td[data-label]::before": {
      content: "attr(data-label)",
      display: "block",
      mb: 0.25,
      fontSize: 12,
      fontWeight: 600,
      color: "text.secondary",
    },
    "& tbody td:not([data-label]), & tbody td[data-wide]": { gridColumn: "1 / -1" },
    "& tbody td[data-actions]": { display: "flex", alignItems: "center", gap: 1, "& > .MuiButton-root": { flex: 1, minHeight: 40 } },
    "& tbody td[data-actions]:empty, & tbody td[data-phone='hide']": { display: "none" },
  },
});

export function Loading() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
      <CircularProgress />
    </Box>
  );
}

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  return <Alert severity="error">{error instanceof Error ? error.message : String(error)}</Alert>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ textAlign: "center", py: 5 }}>
      {children}
    </Typography>
  );
}

export function SummaryBox({ items }: { items: { label: string; value: string }[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(${items.length}, minmax(0, 1fr))` },
        bgcolor: "#f8fafc",
        border: "1px solid #eef1f6",
        borderRadius: 2,
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
          <Typography variant="h6" sx={{ fontSize: { xs: 17, sm: "1.25rem" }, overflowWrap: "anywhere" }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
