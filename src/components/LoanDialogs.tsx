"use client";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { Borrower } from "@/domain/Borrower";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { useBorrowers, useCreateLoan, useReviewRequest } from "@/hooks/queries";
import { emptyLoanForm, LoanForm, previewLoan, toTerms, type LoanFormValues } from "./LoanForm";
import { ErrorAlert } from "./ui";

export function NewLoanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { data: borrowers = [] } = useBorrowers();
  const createLoan = useCreateLoan();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [values, setValues] = useState<LoanFormValues>(emptyLoanForm);

  const close = () => {
    setBorrower(null);
    setValues(emptyLoanForm());
    createLoan.reset();
    onClose();
  };

  const submit = () => {
    if (!borrower) return;
    createLoan.mutate(
      { borrower, terms: { ...toTerms(values), amountPaid: Number(values.amountPaid || 0) } },
      {
        onSuccess: (id) => {
          onCreated?.(id);
          close();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>New Loan</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={borrowers}
            value={borrower}
            onChange={(_, v) => setBorrower(v)}
            getOptionLabel={(b) => `${b.name} (${b.email})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Borrower" required helperText="Wala sa listahan? Idagdag muna sa Contacts." />
            )}
          />
          <LoanForm values={values} onChange={setValues} showAmountPaid />
          <ErrorAlert error={createLoan.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" disabled={!borrower || !previewLoan(values) || createLoan.isPending} onClick={submit}>
          {createLoan.isPending ? "Saving..." : "Save Loan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin sets the final terms (interest, term) for a borrower's request, or declines it. */
export function ReviewRequestDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const review = useReviewRequest();
  const [values, setValues] = useState<LoanFormValues | null>(null);
  const current: LoanFormValues =
    values ??
    (loan
      ? {
          ...emptyLoanForm(),
          principal: String(loan.principal),
          paymentPlan: loan.paymentPlan,
          term: String(loan.term),
          termUnit: loan.termUnit,
          notes: loan.notes,
        }
      : emptyLoanForm());

  const close = () => {
    setValues(null);
    review.reset();
    onClose();
  };

  const act = (approve: boolean) =>
    loan && review.mutate({ loan, terms: approve ? toTerms(current) : null }, { onSuccess: close });

  return (
    <Dialog open={!!loan} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Loan Request — {loan?.borrowerName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {loan && (
            <Typography variant="body2" color="text.secondary">
              Humihiram ng {formatPeso(loan.principal)}. Ipadala sa: <strong>{loan.payoutDetails || "—"}</strong>
            </Typography>
          )}
          <LoanForm values={current} onChange={setValues} />
          <ErrorAlert error={review.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => act(false)} disabled={review.isPending}>
          Decline
        </Button>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={() => act(true)} disabled={!previewLoan(current) || review.isPending}>
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}
