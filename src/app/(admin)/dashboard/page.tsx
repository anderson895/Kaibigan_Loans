"use client";
import ArrowForward from "@mui/icons-material/ArrowForward";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import Percent from "@mui/icons-material/Percent";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import SavingsOutlined from "@mui/icons-material/SavingsOutlined";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useAuth } from "@/components/AuthProvider";
import { LoansTable } from "@/components/LoansTable";
import { ErrorAlert, Loading, PageHeader, StatCard } from "@/components/ui";
import { formatPeso } from "@/domain/money";
import { useActivity, useLoans, usePayments } from "@/hooks/queries";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const loans = useLoans();
  const payments = usePayments();
  const activity = useActivity();

  if (loans.isPending) return <Loading />;
  const all = loans.data ?? [];
  const booked = all.filter((l) => !l.isRequest && l.storedStatus !== "rejected");
  const active = booked.filter((l) => l.isActive);
  const requests = all.filter((l) => l.isRequest);
  const pending = (payments.data ?? []).filter((p) => p.isPending);
  const firstName = user?.displayName?.split(" ")[0] ?? "Admin";

  return (
    <>
      <PageHeader title={`Hello, ${firstName}!`} subtitle="Here's the overview of your loans." />
      <ErrorAlert error={loans.error} />
      {requests.length > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={Link} href="/loans?status=pending" size="small">
              Review
            </Button>
          }
        >
          {requests.length} new loan request(s).
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, mb: 3 }}>
        <StatCard
          icon={<GroupOutlined />}
          label="Total Borrowers"
          value={String(new Set(active.map((l) => l.borrowerEmail)).size)}
          caption="Active borrowers"
        />
        <StatCard
          icon={<SavingsOutlined />}
          label="Total Loaned Amount"
          value={formatPeso(booked.reduce((s, l) => s + l.principal, 0))}
          caption="Across all loans"
        />
        <StatCard
          icon={<Percent />}
          label="Total Interest Earned"
          value={formatPeso(booked.reduce((s, l) => s + l.interestAmount, 0))}
          caption={`From ${booked.filter((l) => l.interestAmount > 0).length} loans`}
        />
        <StatCard
          icon={<ScheduleOutlined />}
          label="Pending Payments"
          value={formatPeso(pending.reduce((s, p) => s + p.amount, 0))}
          caption={`${pending.length} waiting for approval`}
        />
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" } }}>
        <Paper sx={{ p: 2.5, minWidth: 0 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Recent Loans</Typography>
            <Button component={Link} href="/loans" endIcon={<ArrowForward />} size="small">
              View all
            </Button>
          </Stack>
          <LoansTable loans={booked.slice(0, 6)} compact onView={(l) => router.push(`/loans?id=${l.id}`)} />
        </Paper>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Activity
          </Typography>
          {activity.isPending ? <Loading /> : <ActivityFeed items={activity.data ?? []} />}
        </Paper>
      </Box>
    </>
  );
}
