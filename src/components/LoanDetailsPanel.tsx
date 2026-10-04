"use client";
import {
  Box,
  Button,
  Chip,
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
import { BorrowerAvatar, cardsOnPhone, StatusChip, SummaryBox } from "./ui";

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

/** `onMarkPaid` (admin only) adds a button to record the remaining amount of an unpaid installment. */
export function ScheduleTable({ loan, onMarkPaid }: { loan: Loan; onMarkPaid?: (amount: number) => void }) {
  const now = today();
  const canMark = !!onMarkPaid && loan.isActive;
  return (
    <TableContainer sx={cardsOnPhone}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Due Date</TableCell>
            <TableCell>Amount Due</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Paid Date</TableCell>
            {canMark && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {loan.schedule.map((item, index) => (
            <TableRow key={item.dueDate}>
              <TableCell data-label="Due Date">{formatDate(item.dueDate)}</TableCell>
              <TableCell data-label="Amount Due">{formatPeso(item.amountDue)}</TableCell>
              <TableCell data-label="Status">
                {item.status !== "paid" && item.dueDate < now && loan.isActive ? (
                  <StatusChip status="overdue" />
                ) : (
                  <StatusChip status={item.status} />
                )}
              </TableCell>
              <TableCell data-label="Paid Date">{formatDate(item.paidDate)}</TableCell>
              {canMark && (
                <TableCell align="right" data-actions sx={{ whiteSpace: "nowrap" }}>
                  {item.status !== "paid" && (
                    <Button size="small" onClick={() => onMarkPaid?.(loan.remainingFor(index))}>
                      Mark paid{item.status === "partial" ? ` (${formatPeso(loan.remainingFor(index))})` : ""}
                    </Button>
                  )}
                </TableCell>
              )}
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
        No payments yet.
      </Typography>
    );
  }
  return (
    <TableContainer sx={cardsOnPhone}>
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
              <TableCell data-label="Paid On">{formatDate(p.paidOn)}</TableCell>
              <TableCell data-label="Amount">
                {formatPeso(p.amount)}
                <Typography variant="caption" color="text.secondary" component="div">
                  {p.methodLabel}
                </Typography>
              </TableCell>
              <TableCell data-label="Ref No.">{p.referenceNo || "-"}</TableCell>
              <TableCell data-label="Status">
                <StatusChip status={p.status} />
                {p.rejectReason && (
                  <Typography variant="caption" color="error" component="div">
                    {p.rejectReason}
                  </Typography>
                )}
              </TableCell>
              <TableCell data-label="Receipt">
                {p.receiptUrl ? (
                  <MuiLink href={p.receiptUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                    View
                  </MuiLink>
                ) : (
                  <Chip size="small" label={p.methodLabel} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
