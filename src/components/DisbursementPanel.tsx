"use client";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import CloudUpload from "@mui/icons-material/CloudUpload";
import SendOutlined from "@mui/icons-material/SendOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { useAttachDisbursement } from "@/hooks/queries";
import { ocrService } from "@/services/container";
import { ErrorAlert } from "./ui";

export interface ProofOfSendInput {
  file: File;
  referenceNo: string;
  sentOn: string;
}

/** File picker + reference no. + date for the lender's proof of send. OCR pre-fills the reference no. */
export function ProofOfSendFields({ value, onChange }: { value: ProofOfSendInput | null; onChange: (v: ProofOfSendInput | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const base = { file, referenceNo: value?.referenceNo ?? "", sentOn: value?.sentOn ?? today() };
    onChange(base);
    setReading(true);
    setOcrNote(null);
    try {
      const ocr = await ocrService.readReceipt(file);
      if (ocr.referenceNo) onChange({ ...base, referenceNo: ocr.referenceNo });
      setOcrNote(
        ocr.amount || ocr.referenceNo
          ? `Detected${ocr.amount ? ` ${formatPeso(ocr.amount)}` : ""}${ocr.referenceNo ? ` · Ref ${ocr.referenceNo}` : ""}`
          : null,
      );
    } catch {
      // OCR is a convenience only.
    } finally {
      setReading(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Button component="label" variant="outlined" startIcon={<CloudUpload />}>
        {value ? "Change screenshot" : "Upload proof of send (GCash / bank screenshot)"}
        <input hidden type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
      </Button>
      {preview && (
        <Box component="img" src={preview} alt="Proof of send preview" sx={{ maxHeight: 200, objectFit: "contain", borderRadius: 2, border: "1px solid #e5e9f2" }} />
      )}
      {reading && <LinearProgress />}
      {ocrNote && !reading && (
        <Alert severity="success" icon={<AutoAwesome />}>
          {ocrNote}
        </Alert>
      )}
      {value && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField fullWidth label="Reference No." value={value.referenceNo} onChange={(e) => onChange({ ...value, referenceNo: e.target.value })} />
          <TextField
            fullWidth
            type="date"
            label="Date sent"
            value={value.sentOn}
            onChange={(e) => onChange({ ...value, sentOn: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      )}
    </Stack>
  );
}

export function ProofOfSendDialog({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const attach = useAttachDisbursement();
  const [value, setValue] = useState<ProofOfSendInput | null>(null);

  const close = () => {
    setValue(null);
    attach.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Proof of Send</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Upload the screenshot of the {formatPeso(loan.principal)} you sent to {loan.borrowerName}
            {loan.payoutDetails ? ` (${loan.payoutDetails})` : ""}. The borrower will see it on their loan.
          </Typography>
          <ProofOfSendFields value={value} onChange={setValue} />
          <ErrorAlert error={attach.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!value || attach.isPending}
          onClick={() => value && attach.mutate({ loan, ...value }, { onSuccess: close })}
        >
          {attach.isPending ? "Uploading..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Shows the proof of send on a loan. Admins can upload or replace it; borrowers only view it. */
export function DisbursementSection({ loan, canEdit }: { loan: Loan; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const d = loan.disbursement;
  if (!d && !canEdit) return null;
  if (!d && (loan.isRequest || loan.storedStatus === "rejected")) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Proof of Send
      </Typography>
      {d ? (
        <Paper variant="outlined" sx={{ p: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
          <Box component="a" href={d.receiptUrl} target="_blank" rel="noopener" sx={{ flexShrink: 0 }}>
            <Box component="img" src={d.receiptUrl} alt="Proof of send" sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 2, border: "1px solid #e5e9f2" }} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 160 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <SendOutlined color="success" fontSize="small" />
              <Typography sx={{ fontWeight: 600 }}>Money sent on {formatDate(d.sentOn)}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Ref: {d.referenceNo || "-"} ·{" "}
              <MuiLink href={d.receiptUrl} target="_blank" rel="noopener">
                View receipt
              </MuiLink>
            </Typography>
          </Box>
          {canEdit && (
            <Button size="small" onClick={() => setOpen(true)}>
              Replace
            </Button>
          )}
        </Paper>
      ) : (
        // The button sits under the text (not in the Alert's action slot) so phones keep the text readable.
        <Alert severity="warning">
          No proof of send yet. Upload the screenshot after sending the money.
          <Box sx={{ mt: 1 }}>
            <Button size="small" variant="contained" startIcon={<CloudUpload />} onClick={() => setOpen(true)}>
              Upload
            </Button>
          </Box>
        </Alert>
      )}
      {canEdit && <ProofOfSendDialog loan={loan} open={open} onClose={() => setOpen(false)} />}
    </Box>
  );
}
