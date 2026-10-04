"use client";
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { cardsOnPhone, EmptyState, NameCell, StatusChip } from "./ui";

interface Props {
  loans: Loan[];
  selectedId?: string | null;
  onView?: (loan: Loan) => void;
  compact?: boolean;
}

export function LoansTable({ loans, selectedId, onView, compact }: Props) {
  if (!loans.length) return <EmptyState>No loans found.</EmptyState>;
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
          {loans.map((loan) => (
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
              <TableCell data-label="Balance">{formatPeso(loan.balance)}</TableCell>
              <TableCell data-label="Due Date" sx={{ whiteSpace: "nowrap" }}>
                {formatDate(loan.nextDue()?.dueDate ?? loan.dueDate)}
              </TableCell>
              <TableCell data-label="Status">
                <StatusChip status={loan.statusOn(now)} />
              </TableCell>
              {onView && (
                <TableCell align="right" data-actions>
                  <Button size="small" variant="outlined">
                    View
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
