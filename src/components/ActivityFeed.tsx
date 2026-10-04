"use client";
import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";
import CheckCircle from "@mui/icons-material/CheckCircle";
import CloudUpload from "@mui/icons-material/CloudUpload";
import ContactPhoneOutlined from "@mui/icons-material/ContactPhoneOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ErrorIcon from "@mui/icons-material/Error";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import LoginIcon from "@mui/icons-material/Login";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import PersonRemoveOutlined from "@mui/icons-material/PersonRemoveOutlined";
import RemoveModeratorOutlined from "@mui/icons-material/RemoveModeratorOutlined";
import Send from "@mui/icons-material/Send";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { ActivityProps, ActivityType } from "@/data/repositories";
import { formatPeso } from "@/domain/money";
import { EmptyState, StatusChip } from "./ui";

export type ActivityGroup = "loans" | "payments" | "borrowers" | "account" | "admin";

export const ACTIVITY_GROUPS: { value: ActivityGroup; label: string }[] = [
  { value: "loans", label: "Loans" },
  { value: "payments", label: "Payments" },
  { value: "borrowers", label: "Borrowers" },
  { value: "account", label: "Sign-ins & profile" },
  { value: "admin", label: "Admins & settings" },
];

interface ActivityMeta {
  label: string;
  group: ActivityGroup;
  icon: ReactNode;
  bg: string;
  fg: string;
}

const BLUE = { bg: "#e8f0fe", fg: "#1d6ef2" };
const GREEN = { bg: "#dcfce7", fg: "#16a34a" };
const AMBER = { bg: "#fef3c7", fg: "#b45309" };
const RED = { bg: "#fee2e2", fg: "#dc2626" };
const SKY = { bg: "#e0f2fe", fg: "#0284c7" };
const VIOLET = { bg: "#ede9fe", fg: "#6d28d9" };
const SLATE = { bg: "#f1f5f9", fg: "#475569" };

const ACTIVITY: Record<ActivityType, ActivityMeta> = {
  loan_created: { label: "Loan created", group: "loans", icon: <AddIcon />, ...BLUE },
  loan_requested: { label: "Loan requested", group: "loans", icon: <AddIcon />, ...BLUE },
  loan_disbursed: { label: "Money sent", group: "loans", icon: <Send />, ...GREEN },
  loan_updated: { label: "Loan edited", group: "loans", icon: <EditOutlined />, ...AMBER },
  loan_deleted: { label: "Loan deleted", group: "loans", icon: <DeleteOutlined />, ...RED },
  request_approved: { label: "Request approved", group: "loans", icon: <CheckCircle />, ...GREEN },
  request_rejected: { label: "Request declined", group: "loans", icon: <ErrorIcon />, ...RED },
  payment_submitted: { label: "Payment uploaded", group: "payments", icon: <CloudUpload />, ...SKY },
  payment_approved: { label: "Payment approved", group: "payments", icon: <CheckCircle />, ...GREEN },
  payment_recorded: { label: "Payment recorded", group: "payments", icon: <PaymentsOutlined />, ...GREEN },
  payment_deleted: { label: "Payment deleted", group: "payments", icon: <DeleteOutlined />, ...RED },
  payment_rejected: { label: "Payment rejected", group: "payments", icon: <ErrorIcon />, ...RED },
  borrower_registered: { label: "Registered", group: "borrowers", icon: <HowToRegOutlined />, ...GREEN },
  borrower_created: { label: "Borrower added", group: "borrowers", icon: <PersonAddOutlined />, ...BLUE },
  borrower_updated: { label: "Borrower edited", group: "borrowers", icon: <EditOutlined />, ...AMBER },
  borrower_deleted: { label: "Borrower deleted", group: "borrowers", icon: <PersonRemoveOutlined />, ...RED },
  signed_in: { label: "Signed in", group: "account", icon: <LoginIcon />, ...SLATE },
  profile_updated: { label: "Name changed", group: "account", icon: <BadgeOutlined />, ...VIOLET },
  password_changed: { label: "Password changed", group: "account", icon: <LockResetOutlined />, ...VIOLET },
  admin_claimed: { label: "First admin", group: "admin", icon: <AdminPanelSettingsOutlined />, ...VIOLET },
  admin_added: { label: "Admin added", group: "admin", icon: <AdminPanelSettingsOutlined />, ...VIOLET },
  admin_removed: { label: "Admin removed", group: "admin", icon: <RemoveModeratorOutlined />, ...RED },
  contact_updated: { label: "Contact updated", group: "admin", icon: <ContactPhoneOutlined />, ...SLATE },
};

/** Entries of a type this version does not know (e.g. written by a newer one) still render. */
const UNKNOWN: ActivityMeta = { label: "Activity", group: "admin", icon: <HistoryOutlined />, ...SLATE };

export const activityMeta = (type: string): ActivityMeta => ACTIVITY[type as ActivityType] ?? UNKNOWN;

const TAG: Partial<Record<ActivityType, "pending" | "approved" | "rejected">> = {
  payment_submitted: "pending",
  loan_requested: "pending",
  payment_approved: "approved",
  payment_recorded: "approved",
  request_approved: "approved",
  payment_rejected: "rejected",
  request_rejected: "rejected",
};

export function ActivityFeed({ items }: { items: ActivityProps[] }) {
  if (!items.length) return <EmptyState>No activity yet.</EmptyState>;
  return (
    <Stack spacing={2.25}>
      {items.map((item) => {
        const style = activityMeta(item.type);
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
