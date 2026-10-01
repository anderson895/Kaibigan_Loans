"use client";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import CloudUpload from "@mui/icons-material/CloudUpload";
import {
  Alert,
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
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import type { OcrResult, Payment } from "@/domain/Payment";
import { useReviewPayment, useSubmitPayment } from "@/hooks/queries";
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
            {file ? "Palitan ang screenshot" : "Pumili ng screenshot ng resibo"}
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
              <Typography variant="caption">Binabasa ang resibo (OCR)...</Typography>
              <LinearProgress />
            </Box>
          )}
          {ocr && !reading && (
            <Alert severity={ocr.amount ? "success" : "warning"} icon={<AutoAwesome />}>
              {ocr.amount
                ? `Nabasa: ${formatPeso(ocr.amount)}${ocr.referenceNo ? ` · Ref ${ocr.referenceNo}` : ""}. Pakicheck kung tama.`
                : "Hindi mabasa ang amount. Pakilagay nang mano-mano."}
            </Alert>
          )}
          <TextField label="Amount" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} slotProps={pesoAdornment} />
          <TextField label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          <TextField
            label="Petsa ng payment"
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
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setAmount(payment ? String(payment.amount) : "");
    setReason("");
    review.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id]);

  if (!payment) return null;
  const ocrAmount = payment.ocr?.amount;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Review Payment</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ pt: 1 }}>
          <Box
            component="a"
            href={payment.receiptUrl}
            target="_blank"
            rel="noopener"
            sx={{ flex: 1, display: "block", bgcolor: "#f8fafc", borderRadius: 2, textAlign: "center" }}
          >
            <Box component="img" src={payment.receiptUrl} alt="Receipt" sx={{ maxWidth: "100%", maxHeight: 460, objectFit: "contain" }} />
          </Box>
          <Stack spacing={2} sx={{ flex: 1 }}>
            <NameCell name={payment.borrowerName} sub={payment.borrowerEmail} />
            <Typography variant="body2">
              Declared: <strong>{formatPeso(payment.amount)}</strong> · Ref: {payment.referenceNo || "-"} · {formatDate(payment.paidOn)}
            </Typography>
            {ocrAmount != null ? (
              <Alert
                severity={payment.hasOcrMismatch ? "warning" : "success"}
                icon={<AutoAwesome />}
                action={
                  payment.hasOcrMismatch && (
                    <Button size="small" onClick={() => setAmount(String(ocrAmount))}>
                      Use {formatPeso(ocrAmount)}
                    </Button>
                  )
                }
              >
                OCR: {formatPeso(ocrAmount)}
                {payment.ocr?.referenceNo ? ` · Ref ${payment.ocr.referenceNo}` : ""}
                {payment.hasOcrMismatch ? " — hindi tugma sa declared amount" : " — tugma"}
              </Alert>
            ) : (
              <Alert severity="info">Walang nabasang amount ang OCR. Pakicheck ang resibo.</Alert>
            )}
            {payment.isPending ? (
              <>
                <TextField
                  label="Amount na ibabawas sa balance"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  slotProps={pesoAdornment}
                />
                <TextField
                  label="Dahilan (kailangan kapag i-reject)"
                  placeholder="hal. Malabo ang resibo / kulang ang amount"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            ) : (
              <Alert severity={payment.status === "approved" ? "success" : "error"}>
                {payment.status === "approved" ? "Approved" : `Rejected: ${payment.rejectReason}`}
              </Alert>
            )}
            <ErrorAlert error={review.error} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
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
