"use client";
import {
  Autocomplete,
  Box,
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
import { useBorrowers, useCreateLoan, useReviewRequest, useUpdateLoanTerms } from "@/hooks/queries";
import { ProofOfSendFields, type ProofOfSendInput } from "./DisbursementPanel";
import { emptyLoanForm, LoanForm, previewLoan, toTerms, type LoanFormValues } from "./LoanForm";
import { ErrorAlert } from "./ui";

export function NewLoanDialog({
  open,
  onClose,
  onCreated,
  initialBorrower = null,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  /** Pre-selects the borrower (e.g. when opened from the Borrowers list). Pass a new `key` to reset. */
  initialBorrower?: Borrower | null;
}) {
  const { data: borrowers = [] } = useBorrowers();
  const createLoan = useCreateLoan();
  const [borrower, setBorrower] = useState<Borrower | null>(initialBorrower);
  const [values, setValues] = useState<LoanFormValues>(emptyLoanForm);
  const [proof, setProof] = useState<ProofOfSendInput | null>(null);

  const close = () => {
    setBorrower(null);
    setProof(null);
    setValues(emptyLoanForm());
    createLoan.reset();
    onClose();
  };

  const submit = () => {
    if (!borrower) return;
    createLoan.mutate(
      { borrower, terms: { ...toTerms(values), amountPaid: Number(values.amountPaid || 0) }, proof },
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
            getOptionLabel={(b) => `${b.name} (${b.hasEmail ? b.email : "no website account"})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="No borrowers yet. Add one in Borrowers → Add Borrower, or ask them to register."
            renderInput={(params) => (
              <TextField {...params} label="Borrower" required helperText="Not on the list? They need to register first." />
            )}
          />
          <LoanForm values={values} onChange={setValues} showAmountPaid />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Proof of send (optional)
            </Typography>
            <ProofOfSendFields value={proof} onChange={setProof} />
          </Box>
          <ErrorAlert error={createLoan.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" disabled={!borrower || !previewLoan(values) || createLoan.isPending} onClick={submit}>
          {createLoan.isPending ? (proof ? "Uploading..." : "Saving...") : "Save Loan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin sets the final terms (interest, term) for a borrower's request, or declines it. */
/** The form values for an existing loan, so Edit Loan opens pre-filled. */
function formValuesOf(loan: Loan): LoanFormValues {
  return {
    ...emptyLoanForm(),
    principal: String(loan.principal),
    interestType: loan.interestType,
    interestValue: loan.interestType === "none" ? "" : String(loan.interestValue),
    paymentPlan: loan.paymentPlan,
    term: String(loan.term),
    termUnit: loan.termUnit,
    startDate: loan.startDate,
    notes: loan.notes,
  };
}

/** Edit the terms of a loan that has no approved payments yet. Pass a new `key` to reset. */
export function EditLoanDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const update = useUpdateLoanTerms();
  const [values, setValues] = useState<LoanFormValues>(() => formValuesOf(loan));
  const preview = previewLoan(values);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Loan — {loan.borrowerName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            The interest, total, balance and payment schedule will be recalculated. The proof of send stays attached.
          </Typography>
          <LoanForm values={values} onChange={setValues} />
          <ErrorAlert error={update.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!preview || update.isPending}
          onClick={() => update.mutate({ loan, terms: toTerms(values) }, { onSuccess: onClose })}
        >
          {update.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
              Requesting {formatPeso(loan.principal)}. Send to: <strong>{loan.payoutDetails || "—"}</strong>
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
