"use client";
import Download from "@mui/icons-material/Download";
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useMemo } from "react";
import { ErrorAlert, Loading, PageHeader, SummaryBox } from "@/components/ui";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso, roundMoney } from "@/domain/money";
import { useLoans, usePayments } from "@/hooks/queries";

function downloadCsv(loans: Loan[]) {
  const now = today();
  const header = ["Name", "Email", "Credit", "Interest", "Total", "Paid", "Balance", "Start", "Due Date", "Status"];
  const rows = loans.map((l) => [
    l.borrowerName, l.borrowerEmail, l.principal, l.interestAmount, l.totalAmount, l.amountPaid, l.balance, l.startDate, l.dueDate, l.statusOn(now),
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `kaibigan-loans-${now}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const loans = useLoans();
  const payments = usePayments();

  const booked = useMemo(() => (loans.data ?? []).filter((l) => !l.isRequest && l.storedStatus !== "rejected"), [loans.data]);

  const monthly = useMemo(() => {
    const byMonth = new Map<string, { lent: number; collected: number }>();
    const bucket = (key: string) => byMonth.get(key) ?? byMonth.set(key, { lent: 0, collected: 0 }).get(key)!;
    for (const l of booked) bucket(l.startDate.slice(0, 7)).lent += l.principal;
    for (const p of payments.data ?? []) if (p.status === "approved") bucket(p.paidOn.slice(0, 7)).collected += p.amount;
    return [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [booked, payments.data]);

  if (loans.isPending) return <Loading />;
  const sum = (f: (l: Loan) => number) => roundMoney(booked.reduce((s, l) => s + f(l), 0));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Summary of loans and collections."
        action={
          <Button variant="outlined" startIcon={<Download />} onClick={() => downloadCsv(booked)} disabled={!booked.length}>
            Export CSV
          </Button>
        }
      />
      <ErrorAlert error={loans.error ?? payments.error} />
      <Box sx={{ mb: 3 }}>
        <SummaryBox
          items={[
            { label: "Total Lent", value: formatPeso(sum((l) => l.principal)) },
            { label: "Interest (expected)", value: formatPeso(sum((l) => l.interestAmount)) },
            { label: "Collected", value: formatPeso(sum((l) => l.amountPaid)) },
            { label: "Outstanding", value: formatPeso(sum((l) => l.balance)) },
          ]}
        />
      </Box>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Per month
        </Typography>
        <TableContainer>
          <Table size="small" sx={{ "& th, & td": { px: { xs: 1, sm: 2 } } }}>
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Lent</TableCell>
                <TableCell align="right">Collected</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthly.map(([month, v]) => (
                <TableRow key={month}>
                  <TableCell>{formatDate(`${month}-01`).replace(/ 01,/, "")}</TableCell>
                  <TableCell align="right">{formatPeso(v.lent)}</TableCell>
                  <TableCell align="right">{formatPeso(v.collected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
