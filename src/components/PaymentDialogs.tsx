"use client";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import CloudUpload from "@mui/icons-material/CloudUpload";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { PAYMENT_METHOD_LABELS, type ManualPaymentMethod, type OcrResult, type Payment } from "@/domain/Payment";
import { useDeletePayment, useLoans, useRecordPayment, useReviewPayment, useSubmitPayment } from "@/hooks/queries";
import { ocrService } from "@/services/container";
import { ErrorAlert, NameCell } from "./ui";

const pesoAdornment = { input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } };

/**
 * Borrower uploads a receipt screenshot. OCR reads the amount and reference number
 * in the browser and pre-fills the form; the borrower can still correct them.
 */
export function UploadPaymentDialog({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const submit = useSubmitPayment();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [reading, setReading] = useState(false);
  const [amount, setAmount] = useState(String(loan.nextDue()?.amountDue ?? ""));
  const [referenceNo, setReferenceNo] = useState("");
  const [paidOn, setPaidOn] = useState(today());

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pickFile = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setOcr(null);
    setReading(true);
    try {
      const result = await ocrService.readReceipt(picked);
      setOcr(result);
      if (result.amount) setAmount(String(result.amount));
      if (result.referenceNo) setReferenceNo(result.referenceNo);
    } catch {
      setOcr({ amount: null, referenceNo: null, text: "" });
    } finally {
      setReading(false);
    }
  };

  const send = () =>
    file &&
    submit.mutate(
      { loan, amount: Number(amount), referenceNo, paidOn, file, ocr },
      { onSuccess: onClose },
    );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Upload Payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current balance: <strong>{formatPeso(loan.balance)}</strong>
          </Typography>
          <Button component="label" variant="outlined" startIcon={<CloudUpload />} sx={{ py: 1.5 }}>
            {file ? "Change screenshot" : "Choose receipt screenshot"}
            <input hidden type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />
          </Button>
          {preview && (
            <Box
              component="img"
              src={preview}
              alt="Receipt preview"
              sx={{ maxHeight: 220, objectFit: "contain", borderRadius: 2, border: "1px solid #e5e9f2" }}
            />
          )}
          {reading && (
            <Box>
              <Typography variant="caption">Reading receipt (OCR)...</Typography>
              <LinearProgress />
            </Box>
          )}
          {ocr && !reading && (
            <Alert severity={ocr.amount ? "success" : "warning"} icon={<AutoAwesome />}>
              {ocr.amount
                ? `Detected: ${formatPeso(ocr.amount)}${ocr.referenceNo ? ` · Ref ${ocr.referenceNo}` : ""}. Please double-check.`
                : "Could not read the amount. Please enter it manually."}
            </Alert>
          )}
          <TextField label="Amount" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} slotProps={pesoAdornment} />
          <TextField label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          <TextField
            label="Payment date"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <ErrorAlert error={submit.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={send} disabled={!file || reading || !(Number(amount) > 0) || submit.isPending}>
          {submit.isPending ? "Uploading..." : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin reviews a receipt. Approving deducts the amount from the balance immediately. */
export function ReviewPaymentDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const review = useReviewPayment();
  const remove = useDeletePayment();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setAmount(payment ? String(payment.amount) : "");
    setReason("");
    review.reset();
    remove.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id]);

  if (!payment) return null;
  const ocrAmount = payment.ocr?.amount;

  const deletePayment = () => {
    const message = payment.isApproved
      ? `Delete this ${formatPeso(payment.amount)} payment? It will be added back to ${payment.borrowerName}'s balance.`
      : `Delete this ${formatPeso(payment.amount)} payment?`;
    if (confirm(message)) remove.mutate(payment.id, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{payment.isManual ? "Payment Details" : "Review Payment"}</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ pt: 1 }}>
          {payment.receiptUrl ? (
            <Box
              component="a"
              href={payment.receiptUrl}
              target="_blank"
              rel="noopener"
              sx={{ flex: 1, display: "block", bgcolor: "#f8fafc", borderRadius: 2, textAlign: "center" }}
            >
              <Box component="img" src={payment.receiptUrl} alt="Receipt" sx={{ maxWidth: "100%", maxHeight: 460, objectFit: "contain" }} />
            </Box>
          ) : (
            <Stack
              spacing={1}
              sx={{ flex: 1, bgcolor: "#f8fafc", borderRadius: 2, p: 4, alignItems: "center", justifyContent: "center", textAlign: "center" }}
            >
              <Avatar sx={{ width: 64, height: 64, bgcolor: "#dcfce7", color: "#16a34a" }}>
                <PaymentsOutlined fontSize="large" />
              </Avatar>
              <Typography sx={{ fontWeight: 700 }}>{payment.methodLabel} payment</Typography>
              <Typography variant="body2" color="text.secondary">
                Recorded by {payment.recordedBy || "the admin"} — no receipt attached.
              </Typography>
            </Stack>
          )}
          <Stack spacing={2} sx={{ flex: 1 }}>
            <NameCell name={payment.borrowerName} sub={payment.borrowerEmail} />
            <Typography variant="body2">
              {payment.isManual ? "Amount" : "Declared"}: <strong>{formatPeso(payment.amount)}</strong> · {payment.methodLabel} · Ref:{" "}
              {payment.referenceNo || "-"} · {formatDate(payment.paidOn)}
            </Typography>
            {payment.note && (
              <Typography variant="body2" color="text.secondary">
                Note: {payment.note}
              </Typography>
            )}
            {!payment.isManual &&
              (ocrAmount != null ? (
                <Alert
                  severity={payment.hasOcrMismatch ? "warning" : "success"}
                  icon={<AutoAwesome />}
                  action={
                    payment.hasOcrMismatch &&
                    payment.isPending && (
                      <Button size="small" onClick={() => setAmount(String(ocrAmount))}>
                        Use {formatPeso(ocrAmount)}
                      </Button>
                    )
                  }
                >
                  OCR: {formatPeso(ocrAmount)}
                  {payment.ocr?.referenceNo ? ` · Ref ${payment.ocr.referenceNo}` : ""}
                  {payment.hasOcrMismatch ? " — does not match the declared amount" : " — matches"}
                </Alert>
              ) : (
                <Alert severity="info">OCR could not read an amount. Please check the receipt.</Alert>
              ))}
            {payment.isPending ? (
              <>
                <TextField
                  label="Amount to deduct from balance"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  slotProps={pesoAdornment}
                />
                <TextField
                  label="Reason (required to reject)"
                  placeholder="e.g. Blurry receipt / amount is short"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            ) : (
              <Alert severity={payment.status === "approved" ? "success" : "error"}>
                {payment.status === "approved"
                  ? payment.isManual
                    ? "Recorded and deducted from the balance."
                    : "Approved"
                  : `Rejected: ${payment.rejectReason}`}
              </Alert>
            )}
            <ErrorAlert error={review.error ?? remove.error} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" disabled={remove.isPending || review.isPending} onClick={deletePayment} sx={{ mr: "auto" }}>
          {remove.isPending ? "Deleting..." : "Delete payment"}
        </Button>
        <Button onClick={onClose}>Close</Button>
        {payment.isPending && (
          <>
            <Button
              color="error"
              disabled={review.isPending || !reason.trim()}
              onClick={() => review.mutate({ id: payment.id, action: "reject", reason }, { onSuccess: onClose })}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={review.isPending || !(Number(amount) > 0)}
              onClick={() => review.mutate({ id: payment.id, action: "approve", amount: Number(amount) }, { onSuccess: onClose })}
            >
              Approve & deduct
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

const MANUAL_METHODS: ManualPaymentMethod[] = ["cash", "gcash", "bank", "other"];

/**
 * Admin records a payment they received (cash in hand, or GCash/bank they already checked) for
 * borrowers who don't use the website. Approved and deducted right away.
 * Pass `loan` to record for that loan (with an optional `presetAmount`, e.g. one installment);
 * without it, the admin picks the loan. Mount it fresh each time it opens so the form resets.
 */
export function RecordPaymentDialog({
  loan: fixedLoan = null,
  presetAmount,
  onClose,
}: {
  loan?: Loan | null;
  presetAmount?: number;
  onClose: () => void;
}) {
  const record = useRecordPayment();
  const { data: loans = [] } = useLoans();
  const activeLoans = loans.filter((l) => l.isActive);
  const [picked, setPicked] = useState<Loan | null>(fixedLoan);
  const loan = fixedLoan ?? picked;
  const [amount, setAmount] = useState(presetAmount ? String(presetAmount) : "");
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [paidOn, setPaidOn] = useState(today());
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const value = Number(amount);
  const tooMuch = !!loan && value > loan.balance + 0.001;
  const canSave = !!loan && value > 0 && !tooMuch && !record.isPending;

  const save = () => {
    if (!loan) return;
    record.mutate({ loan, amount: value, method, paidOn, referenceNo, note, file }, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Record Payment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {fixedLoan ? (
            <NameCell name={fixedLoan.borrowerName} sub={`Balance: ${formatPeso(fixedLoan.balance)}`} />
          ) : (
            <Autocomplete
              options={activeLoans}
              value={picked}
              onChange={(_, v) => {
                setPicked(v);
                // Suggest what is left on their next installment.
                const next = v?.nextDue();
                if (v && next && !amount) setAmount(String(v.remainingFor(v.schedule.indexOf(next))));
              }}
              getOptionLabel={(l) => `${l.borrowerName} — balance ${formatPeso(l.balance)}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText="No active loans."
              renderInput={(params) => <TextField {...params} label="Loan" required />}
            />
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">
              Paano binayaran
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={method}
              onChange={(_, v: ManualPaymentMethod | null) => v && setMethod(v)}
            >
              {MANUAL_METHODS.map((m) => (
                <ToggleButton key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m].replace(" transfer", "")}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <TextField
            label="Amount received"
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={tooMuch}
            helperText={
              tooMuch && loan
                ? `More than the remaining balance (${formatPeso(loan.balance)}).`
                : loan && value > 0
                  ? `Balance after: ${formatPeso(Math.max(0, loan.balance - value))}`
                  : " "
            }
            slotProps={pesoAdornment}
          />
          <TextField
            label="Date received"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {method !== "cash" && (
            <TextField label="Reference No. (optional)" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          )}
          <TextField
            label="Notes (optional)"
            placeholder={method === "cash" ? "e.g. Inabot sa bahay" : "e.g. Na-check sa GCash"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button component="label" variant="outlined" startIcon={<CloudUpload />} size="small">
            {file ? `Photo: ${file.name}` : "Attach photo / receipt (optional)"}
            <input hidden type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          <Alert severity="info" icon={false}>
            This counts right away — it is deducted from the balance when you click Save.
          </Alert>
          <ErrorAlert error={record.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" disabled={!canSave} onClick={save}>
          {record.isPending ? "Saving..." : "Save Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
