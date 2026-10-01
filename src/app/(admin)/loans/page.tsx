"use client";
import Add from "@mui/icons-material/Add";
import ArrowBack from "@mui/icons-material/ArrowBack";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import Search from "@mui/icons-material/Search";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DisbursementSection } from "@/components/DisbursementPanel";
import { LoanHeader, LoanSummary, PaymentHistory, ScheduleTable } from "@/components/LoanDetailsPanel";
import { EditLoanDialog, NewLoanDialog, ReviewRequestDialog } from "@/components/LoanDialogs";
import { LoansTable } from "@/components/LoansTable";
import { RecordPaymentDialog, ReviewPaymentDialog } from "@/components/PaymentDialogs";
import { ErrorAlert, Loading, PageHeader } from "@/components/ui";
import { today } from "@/domain/dates";
import type { Loan, LoanStatus } from "@/domain/Loan";
import type { Payment } from "@/domain/Payment";
import { useDeleteLoan, useLoanPayments, useLoans } from "@/hooks/queries";

const STATUS_OPTIONS: { value: LoanStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "ongoing", label: "On Going" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Requests" },
  { value: "rejected", label: "Declined" },
];

function LoanDetails({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const payments = useLoanPayments(loan.id);
  const deleteLoan = useDeleteLoan();
  const [reviewing, setReviewing] = useState<Payment | null>(null);
  const [reviewRequest, setReviewRequest] = useState(false);
  const [editing, setEditing] = useState(false);
  // Record Payment dialog: null = closed; the amount pre-fills one installment when using "Mark paid".
  const [recording, setRecording] = useState<{ amount?: number } | null>(null);

  const remove = () => {
    if (confirm(`Delete ${loan.borrowerName}'s loan? Its payments and activity will also be deleted. This cannot be undone.`)) {
      deleteLoan.mutate(loan.id, { onSuccess: onClose });
    }
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <IconButton size="small" onClick={onClose} aria-label="Close details">
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Loan Details
        </Typography>
        {loan.isRequest && (
          <Button variant="contained" size="small" onClick={() => setReviewRequest(true)}>
            Review Request
          </Button>
        )}
        {loan.isActive && (
          <Tooltip title={loan.canEditTerms ? "Edit loan" : "Can't edit after a payment was approved"}>
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditOutlined />}
                disabled={!loan.canEditTerms}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </span>
          </Tooltip>
        )}
        <IconButton size="small" color="error" onClick={remove} aria-label="Delete loan">
          <DeleteOutline />
        </IconButton>
      </Stack>
      <LoanHeader loan={loan} />
      <LoanSummary loan={loan} />
      {(loan.payoutDetails || loan.notes) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {loan.payoutDetails && <>Send to: {loan.payoutDetails}<br /></>}
          {loan.notes && <>Notes: {loan.notes}</>}
        </Typography>
      )}
      <ErrorAlert error={deleteLoan.error} />
      <DisbursementSection loan={loan} canEdit />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
        Payment Schedule
      </Typography>
      <ScheduleTable loan={loan} onMarkPaid={(amount) => setRecording({ amount })} />

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 3, mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Payments
        </Typography>
        {loan.isActive && (
          <Button size="small" variant="contained" color="success" startIcon={<PaymentsOutlined />} onClick={() => setRecording({})}>
            Record Payment
          </Button>
        )}
      </Stack>
      {payments.isPending ? <Loading /> : <PaymentHistory payments={payments.data ?? []} onSelect={setReviewing} />}

      <ReviewPaymentDialog payment={reviewing} onClose={() => setReviewing(null)} />
      <ReviewRequestDialog loan={reviewRequest ? loan : null} onClose={() => setReviewRequest(false)} />
      {editing && <EditLoanDialog loan={loan} onClose={() => setEditing(false)} />}
      {recording && <RecordPaymentDialog loan={loan} presetAmount={recording.amount} onClose={() => setRecording(null)} />}
    </Paper>
  );
}

function LoansView() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LoanStatus | "all">((params.get("status") as LoanStatus) ?? "all");
  const [newOpen, setNewOpen] = useState(false);
  const { data: loans = [], isPending, error } = useLoans();

  const filtered = useMemo(() => {
    const now = today();
    const q = search.trim().toLowerCase();
    return loans.filter(
      (l) =>
        (status === "all" || l.statusOn(now) === status) &&
        (!q || l.borrowerName.toLowerCase().includes(q) || l.borrowerEmail.includes(q)),
    );
  }, [loans, search, status]);

  const selected = loans.find((l) => l.id === selectedId) ?? null;
  const select = (id: string | null) => router.replace(id ? `/loans?id=${id}` : "/loans", { scroll: false });

  return (
    <>
      <PageHeader
        title="Loan List"
        subtitle="Manage all your loans and track payments."
        action={
          <Button variant="contained" startIcon={<Add />} onClick={() => setNewOpen(true)}>
            New Loan
          </Button>
        }
      />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: selected ? "1.2fr 1fr" : "1fr" } }}>
        <Paper sx={{ p: 2.5, minWidth: 0, display: { xs: selected ? "none" : "block", xl: "block" } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flexGrow: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
            />
            <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value as LoanStatus | "all")} sx={{ minWidth: 160 }}>
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <ErrorAlert error={error} />
          {isPending ? <Loading /> : <LoansTable loans={filtered} selectedId={selectedId} onView={(l) => select(l.id)} />}
        </Paper>
        {selected && <LoanDetails key={selected.id} loan={selected} onClose={() => select(null)} />}
      </Box>
      <NewLoanDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => select(id)} />
    </>
  );
}

export default function LoansPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoansView />
    </Suspense>
  );
}
