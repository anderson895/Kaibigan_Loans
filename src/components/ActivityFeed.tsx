"use client";
import AddIcon from "@mui/icons-material/Add";
import CheckCircle from "@mui/icons-material/CheckCircle";
import CloudUpload from "@mui/icons-material/CloudUpload";
import ErrorIcon from "@mui/icons-material/Error";
import Send from "@mui/icons-material/Send";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { ActivityProps, ActivityType } from "@/data/repositories";
import { formatPeso } from "@/domain/money";
import { EmptyState, StatusChip } from "./ui";

const ICONS: Record<ActivityType, { icon: ReactNode; bg: string; fg: string }> = {
  loan_created: { icon: <AddIcon />, bg: "#e8f0fe", fg: "#1d6ef2" },
  loan_disbursed: { icon: <Send />, bg: "#dcfce7", fg: "#16a34a" },
  loan_requested: { icon: <AddIcon />, bg: "#e8f0fe", fg: "#1d6ef2" },
  request_approved: { icon: <CheckCircle />, bg: "#dcfce7", fg: "#16a34a" },
  request_rejected: { icon: <ErrorIcon />, bg: "#fee2e2", fg: "#dc2626" },
  payment_submitted: { icon: <CloudUpload />, bg: "#e0f2fe", fg: "#0284c7" },
  payment_approved: { icon: <CheckCircle />, bg: "#dcfce7", fg: "#16a34a" },
  payment_rejected: { icon: <ErrorIcon />, bg: "#fee2e2", fg: "#dc2626" },
};

const TAG: Partial<Record<ActivityType, "pending" | "approved" | "rejected">> = {
  payment_submitted: "pending",
  loan_requested: "pending",
  payment_approved: "approved",
  request_approved: "approved",
  payment_rejected: "rejected",
  request_rejected: "rejected",
};

export function ActivityFeed({ items }: { items: ActivityProps[] }) {
  if (!items.length) return <EmptyState>No activity yet.</EmptyState>;
  return (
    <Stack spacing={2.25}>
      {items.map((item) => {
        const style = ICONS[item.type];
        const tag = TAG[item.type];
        return (
          <Stack key={item.id} direction="row" spacing={1.5}>
            <Avatar sx={{ bgcolor: style.bg, color: style.fg, width: 36, height: 36 }}>{style.icon}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">
                {item.message}
                {item.amount != null && <strong> {formatPeso(item.amount)}</strong>}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                </Typography>
                {tag && <StatusChip status={tag} sx={{ height: 20, fontSize: 11 }} />}
              </Stack>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
