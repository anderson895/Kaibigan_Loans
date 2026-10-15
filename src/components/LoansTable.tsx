"use client";
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { formatDate, today } from "@/domain/dates";
import type { Loan, LoanStatus } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { cardsOnPhone, EmptyState, NameCell, StatusChip } from "./ui";

/** Money still owed stands out: blue while on time, red when overdue. Paid, requests and declined stay plain. */
const BALANCE_HIGHLIGHT: Partial<Record<LoanStatus, { color: string; bgcolor: string }>> = {
  ongoing: { color: "primary.main", bgcolor: "#e8f0fe" },
  overdue: { color: "#b91c1c", bgcolor: "#fee2e2" },
};

interface Props {
  loans: Loan[];
  selectedId?: string | null;
  onView?: (loan: Loan) => void;
  compact?: boolean;
  emptyText?: string;
}

export function LoansTable({ loans, selectedId, onView, compact, emptyText = "No loans found." }: Props) {
  if (!loans.length) return <EmptyState>{emptyText}</EmptyState>;
  const now = today();
  return (
    <TableContainer sx={cardsOnPhone}>
      <Table size={compact ? "small" : "medium"}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Loan Amount</TableCell>
            <TableCell>Interest</TableCell>
            <TableCell>Total Amount</TableCell>
            <TableCell>Balance</TableCell>
            <TableCell>Due Date</TableCell>
            <TableCell>Status</TableCell>
            {onView && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loans.map((loan) => {
            const status = loan.statusOn(now);
            const highlight = BALANCE_HIGHLIGHT[status];
            return (
              <TableRow
                key={loan.id}
                hover
                selected={loan.id === selectedId}
                onClick={onView ? () => onView(loan) : undefined}
                sx={{ cursor: onView ? "pointer" : undefined }}
              >
                <TableCell>
                  <NameCell name={loan.borrowerName} />
                </TableCell>
                <TableCell data-label="Loan Amount">{formatPeso(loan.principal)}</TableCell>
                <TableCell data-label="Interest">{formatPeso(loan.interestAmount)}</TableCell>
                <TableCell data-label="Total Amount">{formatPeso(loan.totalAmount)}</TableCell>
                <TableCell data-label="Balance">
                  <Box
                    component="span"
                    sx={
                      highlight
                        ? { ...highlight, fontWeight: 700, px: 1, py: 0.5, borderRadius: 1.5, whiteSpace: "nowrap" }
                        : { color: "text.secondary" }
                    }
                  >
                    {formatPeso(loan.balance)}
                  </Box>
                </TableCell>
                <TableCell data-label="Due Date" sx={{ whiteSpace: "nowrap" }}>
                  {formatDate(loan.nextDue()?.dueDate ?? loan.dueDate)}
                </TableCell>
                <TableCell data-label="Status">
                  <StatusChip status={status} />
                </TableCell>
                {onView && (
                  <TableCell align="right" data-actions>
                    <Button size="small" variant="outlined">
                      View
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
