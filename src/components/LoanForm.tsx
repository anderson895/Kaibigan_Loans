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
import { Loan, payDayName, type PayDay, type PaymentPlan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";

export interface LoanFormValues {
  principal: string;
  interestType: InterestType;
  interestValue: string;
  paymentPlan: PaymentPlan;
  term: string;
  termUnit: TermUnit;
  payDay: PayDay;
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
  payDay: null,
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
    payDay: v.payDay,
    startDate: v.startDate,
    notes: v.notes,
  };
}

const TAGALOG_WEEKDAYS = ["Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"];

/** "Every Friday" / "Tuwing Biyernes", "Every 10th & 25th" / "Tuwing 10 at 25". Null = counted from the loan date. */
export function payDayText(payDay: PayDay, tagalog = false): string {
  if (payDay === null) return tagalog ? "Batay sa petsa ng loan" : "Based on loan date";
  if (!tagalog) return `Every ${payDayName(payDay)}`;
  if ("weekday" in payDay) return `Tuwing ${TAGALOG_WEEKDAYS[payDay.weekday]}`;
  if (payDay.dates.length === 2) return `Tuwing ${payDay.dates.map((d) => (d >= 31 ? "katapusan" : d)).join(" at ")}`;
  return payDay.dates[0] >= 31 ? "Tuwing katapusan ng buwan" : `Tuwing ika-${payDay.dates[0]}`;
}

function WeekdayPicker({
  label,
  value,
  onChange,
  tagalog,
}: {
  label: string;
  value: number;
  onChange: (weekday: number) => void;
  tagalog: boolean;
}) {
  return (
    <TextField select fullWidth label={label} value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
        <MenuItem key={weekday} value={String(weekday)}>
          {tagalog ? TAGALOG_WEEKDAYS[weekday] : payDayName({ weekday })}
        </MenuItem>
      ))}
    </TextField>
  );
}

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** A date of the month, picked from a small calendar-like grid (31 = end of the month). */
function MonthDayPicker({
  label,
  value,
  taken,
  onChange,
  tagalog,
}: {
  label: string;
  value: number;
  /** The other pay date, which can't be picked twice. */
  taken?: number;
  onChange: (day: number) => void;
  tagalog: boolean;
}) {
  const name = (day: number) => (tagalog ? (day >= 31 ? "Katapusan" : `ika-${day}`) : payDayName({ dates: [day] })!);
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      slotProps={{
        select: {
          renderValue: (v) => name(Number(v)),
          MenuProps: {
            slotProps: {
              paper: { sx: { width: 300 } },
              list: { sx: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, p: 1 } },
            },
          },
        },
      }}
    >
      {MONTH_DAYS.map((day) => (
        <MenuItem
          key={day}
          value={String(day)}
          disabled={day === taken}
          // Row 5 has the 29th and 30th; "end of month" fills the rest of it.
          sx={{ justifyContent: "center", borderRadius: 1, minHeight: 36, px: 0, gridColumn: day === 31 ? "span 5" : undefined }}
        >
          {day === 31 ? (tagalog ? "Katapusan" : "Month end") : day}
        </MenuItem>
      ))}
    </TextField>
  );
}

type PayOften = "auto" | "week" | "once" | "twice";

/**
 * The day(s) the borrower pays, whatever the term unit: every week on a weekday, or once or twice a
 * month on the dates picked (e.g. every 10th and 25th).
 */
export function PayDayField({
  payDay,
  onChange,
  tagalog = false,
}: {
  payDay: PayDay;
  onChange: (payDay: PayDay) => void;
  tagalog?: boolean;
}) {
  const often: PayOften = payDay === null ? "auto" : "weekday" in payDay ? "week" : payDay.dates.length === 2 ? "twice" : "once";
  const dates = payDay !== null && "dates" in payDay ? payDay.dates : [];
  const changeOften = (next: PayOften) => {
    // Keep the date(s) already picked where possible; otherwise start from Monday / the 15th / kinsenas at katapusan.
    if (next === "auto") onChange(null);
    else if (next === "week") onChange({ weekday: 1 });
    else if (next === "once") onChange({ dates: [dates[0] ?? 15] });
    else onChange({ dates: dates.length === 2 ? dates : [15, 31] });
  };
  const every = tagalog ? "Tuwing" : "Every";
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {/* Select values are strings; "auto" stands for null (an empty value would leave the label over the text). */}
      <TextField
        select
        fullWidth
        label={tagalog ? "Araw ng bayad" : "Pay day"}
        value={often}
        onChange={(e) => changeOften(e.target.value as PayOften)}
      >
        <MenuItem value="auto">{payDayText(null, tagalog)}</MenuItem>
        <MenuItem value="week">{tagalog ? "Linggo-linggo" : "Every week"}</MenuItem>
        <MenuItem value="once">{tagalog ? "Isang beses kada buwan" : "Once a month"}</MenuItem>
        <MenuItem value="twice">{tagalog ? "Dalawang beses kada buwan" : "Twice a month"}</MenuItem>
      </TextField>
      {payDay !== null && "weekday" in payDay && (
        <WeekdayPicker label={every} value={payDay.weekday} onChange={(weekday) => onChange({ weekday })} tagalog={tagalog} />
      )}
      {often === "once" && (
        <MonthDayPicker label={every} value={dates[0]} onChange={(day) => onChange({ dates: [day] })} tagalog={tagalog} />
      )}
      {often === "twice" && (
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <MonthDayPicker
            label={every}
            value={dates[0]}
            taken={dates[1]}
            onChange={(day) => onChange({ dates: [day, dates[1]] })}
            tagalog={tagalog}
          />
          <MonthDayPicker
            label={tagalog ? "at" : "and"}
            value={dates[1]}
            taken={dates[0]}
            onChange={(day) => onChange({ dates: [dates[0], day] })}
            tagalog={tagalog}
          />
        </Stack>
      )}
    </Stack>
  );
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

/** Payment plan + term length + unit (weeks/months) + pay day. Shared by the admin form and the borrower request. */
export function TermFields({
  paymentPlan,
  term,
  termUnit,
  payDay,
  onChange,
  tagalog = false,
}: {
  paymentPlan: PaymentPlan;
  term: string;
  termUnit: TermUnit;
  payDay: PayDay;
  onChange: (changes: { paymentPlan?: PaymentPlan; term?: string; termUnit?: TermUnit; payDay?: PayDay }) => void;
  /** Taglish labels for the borrower-facing Request Loan form; the admin form stays in English. */
  tagalog?: boolean;
}) {
  const unitLabel = termUnit === "weeks" ? (tagalog ? "linggo" : "weeks") : tagalog ? "buwan" : "months";
  const termLabel = tagalog
    ? paymentPlan === "lump"
      ? `Babayaran after ilang ${unitLabel}`
      : `Ilang ${unitLabel} huhulugan`
    : paymentPlan === "lump"
      ? `Due after (${unitLabel})`
      : `Number of ${unitLabel}`;
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          fullWidth
          label="Payment plan"
          value={paymentPlan}
          onChange={(e) => onChange({ paymentPlan: e.target.value as PaymentPlan })}
        >
          <MenuItem value="installment">{tagalog ? "Hulugan (Installment)" : "Installments"}</MenuItem>
          <MenuItem value="lump">{tagalog ? "Isang bagsak" : "One-time payment"}</MenuItem>
        </TextField>
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <TextField
            fullWidth
            label={termLabel}
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
      <PayDayField payDay={payDay} onChange={(next) => onChange({ payDay: next })} tagalog={tagalog} />
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
  const day = payDayName(values.payDay);
  const often = day ? `every ${day}` : values.termUnit === "weeks" ? "weekly" : "monthly";

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
          <ToggleButton value="none">No interest</ToggleButton>
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
        payDay={values.payDay}
        onChange={(changes) => onChange({ ...values, ...changes })}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label="Loan date"
          type="date"
          value={values.startDate}
          onChange={(e) => set("startDate", e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {showAmountPaid && (
          <TextField
            fullWidth
            label="Already paid (old record)"
            type="number"
            value={values.amountPaid}
            onChange={(e) => set("amountPaid", e.target.value)}
            helperText="For importing old records"
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
              ? `One-time payment of ${formatPeso(preview.schedule[0].amountDue)} on ${formatDate(preview.schedule[0].dueDate)}`
              : `${preview.schedule.length} × ${formatPeso(preview.schedule[0].amountDue)} ${often}, starting ${formatDate(preview.schedule[0].dueDate)}`}
          </Typography>
        </Alert>
      ) : (
        <Alert severity="warning">Enter a valid loan amount to see the total.</Alert>
      )}
    </Stack>
  );
}
