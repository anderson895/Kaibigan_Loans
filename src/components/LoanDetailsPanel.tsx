"use client";
import {
  Box,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import type { Payment } from "@/domain/Payment";
import { BorrowerAvatar, StatusChip, SummaryBox } from "./ui";

export function LoanHeader({ loan, action }: { loan: Loan; action?: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2.5 }}>
      <BorrowerAvatar name={loan.borrowerName} size={56} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="h6">{loan.borrowerName}</Typography>
          <StatusChip status={loan.statusOn(today())} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Borrowed on {formatDate(loan.startDate)} · {loan.planLabel()}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function LoanSummary({ loan }: { loan: Loan }) {
  return (
    <SummaryBox
      items={[
        { label: "Loan Amount", value: formatPeso(loan.principal) },
        { label: `Interest (${loan.interestLabel()})`, value: formatPeso(loan.interestAmount) },
        { label: "Total Amount", value: formatPeso(loan.totalAmount) },
        { label: "Current Balance", value: formatPeso(loan.balance) },
      ]}
    />
  );
}

export function ScheduleTable({ loan }: { loan: Loan }) {
  const now = today();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Due Date</TableCell>
            <TableCell>Amount Due</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Paid Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loan.schedule.map((item) => (
            <TableRow key={item.dueDate}>
              <TableCell>{formatDate(item.dueDate)}</TableCell>
              <TableCell>{formatPeso(item.amountDue)}</TableCell>
              <TableCell>
                {item.status !== "paid" && item.dueDate < now && loan.isActive ? (
                  <StatusChip status="overdue" />
                ) : (
                  <StatusChip status={item.status} />
                )}
              </TableCell>
              <TableCell>{formatDate(item.paidDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PaymentHistory({ payments, onSelect }: { payments: Payment[]; onSelect?: (payment: Payment) => void }) {
  if (!payments.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No payments uploaded yet.
      </Typography>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Paid On</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Ref No.</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Receipt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((p) => (
            <TableRow
              key={p.id}
              hover={!!onSelect}
              onClick={onSelect ? () => onSelect(p) : undefined}
              sx={{ cursor: onSelect ? "pointer" : undefined }}
            >
              <TableCell>{formatDate(p.paidOn)}</TableCell>
              <TableCell>{formatPeso(p.amount)}</TableCell>
              <TableCell>{p.referenceNo || "-"}</TableCell>
              <TableCell>
                <StatusChip status={p.status} />
                {p.rejectReason && (
                  <Typography variant="caption" color="error" component="div">
                    {p.rejectReason}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <MuiLink href={p.receiptUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                  View
                </MuiLink>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
