"use client";
import {
  Alert,
  Box,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { formatDate, today } from "@/domain/dates";
import type { InterestType, TermUnit } from "@/domain/InterestStrategy";
import { Loan, type PaymentPlan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";

export interface LoanFormValues {
  principal: string;
  interestType: InterestType;
  interestValue: string;
  paymentPlan: PaymentPlan;
  term: string;
  termUnit: TermUnit;
  startDate: string;
  notes: string;
  amountPaid: string;
}

export const emptyLoanForm = (): LoanFormValues => ({
  principal: "",
  interestType: "fixed",
  interestValue: "",
  paymentPlan: "installment",
  term: "1",
  termUnit: "months",
  startDate: today(),
  notes: "",
  amountPaid: "",
});

export function toTerms(v: LoanFormValues) {
  return {
    principal: Number(v.principal),
    interestType: v.interestType,
    interestValue: v.interestType === "none" ? 0 : Number(v.interestValue || 0),
    paymentPlan: v.paymentPlan,
    term: Number(v.term || 1),
    termUnit: v.termUnit,
    startDate: v.startDate,
    notes: v.notes,
  };
}

/** Builds a throwaway Loan to preview totals and the schedule while typing. */
export function previewLoan(v: LoanFormValues): Loan | null {
  try {
    return Loan.create({
      ...toTerms(v),
      borrowerId: "",
      borrowerName: "",
      borrowerEmail: "",
      amountPaid: Number(v.amountPaid || 0),
    });
  } catch {
    return null;
  }
}

/** Payment plan + term length + unit (weeks/months). Shared by the admin form and the borrower request. */
export function TermFields({
  paymentPlan,
  term,
  termUnit,
  onChange,
}: {
  paymentPlan: PaymentPlan;
  term: string;
  termUnit: TermUnit;
  onChange: (changes: { paymentPlan?: PaymentPlan; term?: string; termUnit?: TermUnit }) => void;
}) {
  const unitLabel = termUnit === "weeks" ? "weeks" : "months";
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        select
        fullWidth
        label="Payment plan"
        value={paymentPlan}
        onChange={(e) => onChange({ paymentPlan: e.target.value as PaymentPlan })}
      >
        <MenuItem value="installment">Hulugan (Installment)</MenuItem>
        <MenuItem value="lump">Isang bagsak</MenuItem>
      </TextField>
      <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
        <TextField
          fullWidth
          label={paymentPlan === "lump" ? `Babayaran after (${unitLabel})` : `Ilang ${unitLabel}`}
          type="number"
          value={term}
          onChange={(e) => onChange({ term: e.target.value })}
          slotProps={{ htmlInput: { min: 1, max: termUnit === "weeks" ? 52 : 36 } }}
        />
        <TextField
          select
          label="Unit"
          value={termUnit}
          onChange={(e) => onChange({ termUnit: e.target.value as TermUnit })}
          sx={{ minWidth: 110 }}
        >
          <MenuItem value="weeks">Weeks</MenuItem>
          <MenuItem value="months">Months</MenuItem>
        </TextField>
      </Stack>
    </Stack>
  );
}

interface Props {
  values: LoanFormValues;
  onChange: (values: LoanFormValues) => void;
  showAmountPaid?: boolean;
}

export function LoanForm({ values, onChange, showAmountPaid }: Props) {
  const set = <K extends keyof LoanFormValues>(key: K, value: LoanFormValues[K]) => onChange({ ...values, [key]: value });
  const preview = useMemo(() => previewLoan(values), [values]);
  const peso = { input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } };
  const unitSingular = values.termUnit === "weeks" ? "week" : "month";

  return (
    <Stack spacing={2}>
      <TextField
        label="Loan amount"
        type="number"
        required
        value={values.principal}
        onChange={(e) => set("principal", e.target.value)}
        slotProps={peso}
      />

      <Box>
        <Typography variant="caption" color="text.secondary">
          Interest
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={values.interestType}
          onChange={(_, v: InterestType | null) => v && set("interestType", v)}
        >
          <ToggleButton value="none">Walang interest</ToggleButton>
          <ToggleButton value="fixed">Fixed amount</ToggleButton>
          <ToggleButton value="percent">% per {unitSingular}</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {values.interestType !== "none" && (
        <TextField
          label={values.interestType === "fixed" ? "Interest amount (total)" : `Interest rate per ${unitSingular}`}
          type="number"
          value={values.interestValue}
          onChange={(e) => set("interestValue", e.target.value)}
          slotProps={
            values.interestType === "fixed"
              ? peso
              : { input: { endAdornment: <InputAdornment position="end">% / {unitSingular}</InputAdornment> } }
          }
        />
      )}

      <TermFields
        paymentPlan={values.paymentPlan}
        term={values.term}
        termUnit={values.termUnit}
        onChange={(changes) => onChange({ ...values, ...changes })}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="Petsa ng loan"
          type="date"
          value={values.startDate}
          onChange={(e) => set("startDate", e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {showAmountPaid && (
          <TextField
            fullWidth
            label="Nabayaran na (lumang record)"
            type="number"
            value={values.amountPaid}
            onChange={(e) => set("amountPaid", e.target.value)}
            helperText="Para sa pag-import mula sa Word"
            slotProps={peso}
          />
        )}
      </Stack>

      <TextField label="Notes" multiline minRows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />

      {preview ? (
        <Alert severity="info" icon={false}>
          <Typography variant="body2">
            Interest: <strong>{formatPeso(preview.interestAmount)}</strong> · Total: <strong>{formatPeso(preview.totalAmount)}</strong>
            {" "}· Balance: <strong>{formatPeso(preview.balance)}</strong>
          </Typography>
          <Typography variant="body2">
            {preview.schedule.length === 1
              ? `Isang bagsak na ${formatPeso(preview.schedule[0].amountDue)} sa ${formatDate(preview.schedule[0].dueDate)}`
              : `${preview.schedule.length} × ${formatPeso(preview.schedule[0].amountDue)} ${values.termUnit === "weeks" ? "kada linggo" : "kada buwan"}, simula ${formatDate(preview.schedule[0].dueDate)}`}
          </Typography>
        </Alert>
      ) : (
        <Alert severity="warning">Ilagay ang tamang loan amount para makita ang total.</Alert>
      )}
    </Stack>
  );
}
