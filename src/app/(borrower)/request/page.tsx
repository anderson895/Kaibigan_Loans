"use client";
import CallOutlined from "@mui/icons-material/CallOutlined";
import ChatOutlined from "@mui/icons-material/ChatOutlined";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import SmsOutlined from "@mui/icons-material/SmsOutlined";
import { Alert, Box, Button, Divider, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { TermFields } from "@/components/LoanForm";
import { Loading, PageHeader } from "@/components/ui";
import type { TermUnit } from "@/domain/InterestStrategy";
import type { PaymentPlan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { useLenderContact, useMyBorrower } from "@/hooks/queries";
import { toE164, toMailtoUrl, toSmsUrl } from "@/services/LenderContactService";

interface RequestDetails {
  name: string;
  email: string;
  amount: number;
  plan: PaymentPlan;
  term: number;
  unit: TermUnit;
  payout: string;
  notes: string;
}

/** The borrowing request as plain text, ready to paste or pre-fill in Email/SMS. */
function buildMessage(d: RequestDetails): string {
  const unit = d.unit === "weeks" ? (d.term === 1 ? "week" : "weeks") : d.term === 1 ? "month" : "months";
  const plan = d.plan === "lump" ? `One-time payment after ${d.term} ${unit}` : `Installments over ${d.term} ${unit}`;
  return [
    "Hi! I'd like to request a loan.",
    "",
    `Amount: ${formatPeso(d.amount)}`,
    `Payment plan: ${plan}`,
    `Send the money to: ${d.payout}`,
    d.notes ? `Notes: ${d.notes}` : "",
    "",
    `Name: ${d.name}`,
    `Email: ${d.email}`,
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

/**
 * Borrowers send a borrowing request to the lender by Messenger, Email or SMS.
 * Nothing is saved here — the lender creates the actual loan.
 */
export default function RequestLoanPage() {
  const contact = useLenderContact();
  const me = useMyBorrower();
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState<PaymentPlan>("lump");
  const [term, setTerm] = useState("1");
  const [unit, setUnit] = useState<TermUnit>("weeks");
  const [payout, setPayout] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  if (contact.isPending || me.isPending) return <Loading />;
  const lender = contact.data ?? { messengerUrl: "", email: "", phone: "" };
  const payoutValue = payout ?? me.data?.payoutDetails ?? "";
  const ready = Number(amount) > 0 && Number(term) > 0 && payoutValue.trim().length > 0;

  const message = buildMessage({
    name: me.data?.name ?? "",
    email: me.data?.email ?? "",
    amount: Number(amount) || 0,
    plan,
    term: Number(term) || 1,
    unit,
    payout: payoutValue.trim(),
    notes: notes.trim(),
  });

  const copyMessage = () =>
    navigator.clipboard
      ?.writeText(message)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));

  // Messenger can't pre-fill a message for personal accounts, so copy it first, then open the chat.
  const sendViaMessenger = () => {
    copyMessage();
    window.open(lender.messengerUrl, "_blank", "noopener");
  };

  const hasAnyChannel = lender.messengerUrl || lender.email || toE164(lender.phone);

  return (
    <>
      <PageHeader title="Request Loan" subtitle="Fill in the details, then send your request by Messenger, Email or SMS." />
      <Paper sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 620 }}>
        <Stack spacing={2.5}>
          <TextField
            label="How much do you need?"
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } }}
          />
          <TermFields
            paymentPlan={plan}
            term={term}
            termUnit={unit}
            onChange={(c) => {
              if (c.paymentPlan) setPlan(c.paymentPlan);
              if (c.term !== undefined) setTerm(c.term);
              if (c.termUnit) setUnit(c.termUnit);
            }}
          />
          <TextField
            label="Where to send the money"
            placeholder="GCash 0917 123 4567 — Juan D."
            required
            multiline
            minRows={2}
            value={payoutValue}
            onChange={(e) => setPayout(e.target.value)}
          />
          <TextField label="Purpose / notes (optional)" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <Divider>Send request via</Divider>

          {!hasAnyChannel && <Alert severity="info">Your lender hasn&apos;t added their contact details yet. Please message them directly.</Alert>}

          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<ChatOutlined />}
              disabled={!ready || !lender.messengerUrl}
              onClick={sendViaMessenger}
              sx={{ py: 1.4, borderRadius: 2.5 }}
            >
              Messenger
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<EmailOutlined />}
              disabled={!ready || !lender.email}
              href={ready && lender.email ? toMailtoUrl(lender.email, `Loan request — ${formatPeso(Number(amount) || 0)}`, message) : undefined}
              sx={{ py: 1.4, borderRadius: 2.5, borderWidth: 1.5 }}
            >
              Email
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<SmsOutlined />}
              disabled={!ready || !toE164(lender.phone)}
              href={ready && toE164(lender.phone) ? toSmsUrl(lender.phone, message) : undefined}
              sx={{ py: 1.4, borderRadius: 2.5, borderWidth: 1.5 }}
            >
              SMS
            </Button>
          </Box>
          {!ready && (
            <Typography variant="caption" color="text.secondary">
              Enter the amount and where to send the money to enable the buttons.
            </Typography>
          )}
          {copied && (
            <Alert severity="success">
              Request copied! Paste it in the Messenger chat that just opened (long-press → Paste, or Ctrl+V).
            </Alert>
          )}

          {ready && (
            <Box>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Your request
                </Typography>
                <Button size="small" onClick={copyMessage}>
                  Copy
                </Button>
              </Stack>
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: "#f1f5fb", borderRadius: 2, fontFamily: "inherit", fontSize: 14, whiteSpace: "pre-wrap" }}>
                {message}
              </Box>
            </Box>
          )}

          {toE164(lender.phone) && (
            <Button href={`tel:${toE164(lender.phone)}`} startIcon={<CallOutlined />} sx={{ alignSelf: "flex-start" }}>
              Or call {lender.phone}
            </Button>
          )}
        </Stack>
      </Paper>
    </>
  );
}
