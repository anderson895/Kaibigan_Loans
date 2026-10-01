"use client";
import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useState } from "react";
import { BorrowerDialog } from "@/components/BorrowerDialog";
import { EmptyState, ErrorAlert, Loading, NameCell, PageHeader } from "@/components/ui";
import type { Borrower } from "@/domain/Borrower";
import { formatPeso } from "@/domain/money";
import { useBorrowers, useDeleteBorrower, useLoans } from "@/hooks/queries";

export default function BorrowersPage() {
  const { data: borrowers = [], isPending, error } = useBorrowers();
  const { data: loans = [] } = useLoans();
  const remove = useDeleteBorrower();
  const [dialog, setDialog] = useState<{ open: boolean; borrower: Borrower | null; key: number }>({ open: false, borrower: null, key: 0 });
  const openDialog = (borrower: Borrower | null) => setDialog({ open: true, borrower, key: dialog.key + 1 });

  const balanceOf = (email: string) =>
    loans.filter((l) => l.borrowerEmail === email && l.isActive).reduce((sum, l) => sum + l.balance, 0);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="Ang mga kaibigang pinapautang mo. Ang email nila ang gagamitin sa pag-login."
        action={
          <Button variant="contained" startIcon={<Add />} onClick={() => openDialog(null)}>
            New Contact
          </Button>
        }
      />
      <Paper sx={{ p: 2.5 }}>
        <ErrorAlert error={error ?? remove.error} />
        {isPending ? (
          <Loading />
        ) : borrowers.length === 0 ? (
          <EmptyState>Wala pang contact. Magdagdag muna bago gumawa ng loan.</EmptyState>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Saan ipapadala</TableCell>
                  <TableCell>Outstanding</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {borrowers.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <NameCell name={b.name} sub={b.email} />
                    </TableCell>
                    <TableCell>{b.phone || "-"}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>{b.payoutDetails || "-"}</TableCell>
                    <TableCell>{formatPeso(balanceOf(b.email))}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <IconButton size="small" onClick={() => openDialog(b)} aria-label="Edit">
                        <EditOutlined />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => confirm(`Burahin si ${b.name}?`) && remove.mutate(b.id)}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <BorrowerDialog
        key={dialog.key}
        open={dialog.open}
        borrower={dialog.borrower}
        onClose={() => setDialog({ ...dialog, open: false })}
      />
    </>
  );
}
