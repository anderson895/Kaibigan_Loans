"use client";
import { Alert, Button, InputAdornment, Paper, Stack, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert, Loading, PageHeader } from "@/components/ui";
import { today } from "@/domain/dates";
import { TermFields } from "@/components/LoanForm";
import type { TermUnit } from "@/domain/InterestStrategy";
import type { PaymentPlan } from "@/domain/Loan";
import { useMyBorrower, useRequestLoan } from "@/hooks/queries";

export default function RequestLoanPage() {
  const router = useRouter();
  const me = useMyBorrower();
  const request = useRequestLoan();
  const [principal, setPrincipal] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("installment");
  const [term, setTerm] = useState("1");
  const [termUnit, setTermUnit] = useState<TermUnit>("months");
  const [payoutDetails, setPayoutDetails] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  if (me.isPending) return <Loading />;
  if (!me.data) return <Alert severity="warning">Hindi pa naka-link ang account mo. Makipag-ugnayan sa nagpautang.</Alert>;
  const borrower = me.data;
  const payout = payoutDetails ?? borrower.payoutDetails;

  const submit = () =>
    request.mutate(
      [borrower, { principal: Number(principal), paymentPlan, term: Number(term), termUnit, payoutDetails: payout, notes }, today()],
      { onSuccess: () => router.push("/my-loans") },
    );

  return (
    <>
      <PageHeader title="Request Loan" subtitle="Makikita ito ng nagpautang, at siya ang magse-set ng final na terms." />
      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 560 }}>
        <Stack spacing={2}>
          <TextField
            label="Magkano ang kailangan mo?"
            type="number"
            required
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } }}
          />
          <TermFields
            paymentPlan={paymentPlan}
            term={term}
            termUnit={termUnit}
            onChange={(c) => {
              if (c.paymentPlan) setPaymentPlan(c.paymentPlan);
              if (c.term !== undefined) setTerm(c.term);
              if (c.termUnit) setTermUnit(c.termUnit);
            }}
          />
          <TextField
            label="Saan ipapadala ang pera"
            placeholder="GCash 0917 123 4567 — Juan D."
            required
            multiline
            minRows={2}
            value={payout}
            onChange={(e) => setPayoutDetails(e.target.value)}
          />
          <TextField label="Para saan / notes (optional)" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <ErrorAlert error={request.error} />
          <Button
            variant="contained"
            size="large"
            disabled={!(Number(principal) > 0) || !payout.trim() || request.isPending}
            onClick={submit}
          >
            {request.isPending ? "Sending..." : "Send Request"}
          </Button>
        </Stack>
      </Paper>
    </>
  );
}
