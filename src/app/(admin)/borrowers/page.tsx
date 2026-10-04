"use client";
import Add from "@mui/icons-material/Add";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Search from "@mui/icons-material/Search";
import {
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BorrowerDialog } from "@/components/BorrowerDialog";
import { NewLoanDialog } from "@/components/LoanDialogs";
import { cardsOnPhone, EmptyState, ErrorAlert, Loading, NameCell, PageHeader } from "@/components/ui";
import type { Borrower } from "@/domain/Borrower";
import { formatPeso } from "@/domain/money";
import { useBorrowers, useLoans } from "@/hooks/queries";

/** Everyone who registered (or was added earlier) — the lender picks from here to create a loan. */
export default function BorrowersPage() {
  const router = useRouter();
  const { data: borrowers = [], isPending, error } = useBorrowers();
  const { data: loans = [] } = useLoans();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ borrower: Borrower; key: number } | null>(null);
  const [lendTo, setLendTo] = useState<{ borrower: Borrower; key: number } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return borrowers.filter((b) => !q || b.name.toLowerCase().includes(q) || b.email.includes(q));
  }, [borrowers, search]);

  // By id, not email: borrowers added without an email would otherwise share stats.
  const statsOf = (borrowerId: string) => {
    const active = loans.filter((l) => l.borrowerId === borrowerId && l.isActive);
    return { active: active.length, outstanding: active.reduce((sum, l) => sum + l.balance, 0) };
  };

  return (
    <>
      <PageHeader
        title="Borrowers"
        subtitle="Everyone who registered, plus borrowers you added yourself. Pick one to create a loan."
        action={
          <Button variant="contained" startIcon={<PersonAddOutlined />} onClick={() => setAdding(Date.now())}>
            Add Borrower
          </Button>
        }
      />
      <Paper sx={{ p: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, width: { xs: "100%", sm: 360 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
        />
        <ErrorAlert error={error} />
        {isPending ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState>
            {borrowers.length === 0
              ? "No borrowers yet. They appear here once they register — or click Add Borrower to add someone who won't use the website."
              : "No matches."}
          </EmptyState>
        ) : (
          <TableContainer sx={cardsOnPhone}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Send money to</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Active Loans</TableCell>
                  <TableCell>Outstanding</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((b) => {
                  const stats = statsOf(b.id);
                  return (
                    <TableRow key={b.id} hover>
                      <TableCell>
                        <NameCell name={b.name} sub={b.hasEmail ? b.email : "No website account"} />
                      </TableCell>
                      <TableCell data-label="Phone">{b.phone || "-"}</TableCell>
                      <TableCell data-label="Send money to" sx={{ maxWidth: 240 }}>
                        {b.payoutDetails || "-"}
                      </TableCell>
                      <TableCell data-label="Joined" sx={{ whiteSpace: "nowrap" }}>
                        {new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell data-label="Active Loans">{stats.active}</TableCell>
                      <TableCell data-label="Outstanding">{formatPeso(stats.outstanding)}</TableCell>
                      <TableCell align="right" data-actions sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Edit phone / payout details">
                          <IconButton size="small" onClick={() => setEditing({ borrower: b, key: Date.now() })} aria-label={`Edit ${b.name}`}>
                            <EditOutlined />
                          </IconButton>
                        </Tooltip>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Add />}
                          sx={{ ml: { xs: 0, sm: 1 } }}
                          onClick={() => setLendTo({ borrower: b, key: Date.now() })}
                        >
                          New Loan
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      {editing && <BorrowerDialog key={editing.key} open borrower={editing.borrower} onClose={() => setEditing(null)} />}
      {adding && <BorrowerDialog key={adding} open borrower={null} onClose={() => setAdding(null)} />}
      {lendTo && (
        <NewLoanDialog
          key={lendTo.key}
          open
          initialBorrower={lendTo.borrower}
          onClose={() => setLendTo(null)}
          onCreated={(id) => router.push(`/loans?id=${id}`)}
        />
      )}
    </>
  );
}
