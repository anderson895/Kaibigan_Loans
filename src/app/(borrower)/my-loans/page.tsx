"use client";
import ArrowBack from "@mui/icons-material/ArrowBack";
import CloudUpload from "@mui/icons-material/CloudUpload";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { NotLinkedCard } from "@/components/NotLinkedCard";
import { LoanHeader, LoanSummary, PaymentHistory, ScheduleTable } from "@/components/LoanDetailsPanel";
import { UploadPaymentDialog } from "@/components/PaymentDialogs";
import { EmptyState, ErrorAlert, Loading, PageHeader, StatusChip } from "@/components/ui";
import { formatDate, today } from "@/domain/dates";
import type { Loan } from "@/domain/Loan";
import { formatPeso } from "@/domain/money";
import { useLoanPayments, useMyBorrower, useMyLoans } from "@/hooks/queries";

function LoanCard({ loan, onOpen }: { loan: Loan; onOpen: () => void }) {
  const next = loan.nextDue();
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onOpen}>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Loan · {formatDate(loan.startDate)}
            </Typography>
            <StatusChip status={loan.statusOn(today())} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Current Balance
          </Typography>
          <Typography variant="h4">{formatPeso(loan.balance)}</Typography>
          <Typography variant="body2" color="text.secondary">
            of {formatPeso(loan.totalAmount)}
            {next && loan.isActive && ` · Susunod: ${formatPeso(next.amountDue)} sa ${formatDate(next.dueDate)}`}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function MyLoanDetails({ loan, onBack }: { loan: Loan; onBack: () => void }) {
  const payments = useLoanPayments(loan.id, true);
  const [uploading, setUploading] = useState(false);
  const pendingCount = (payments.data ?? []).filter((p) => p.isPending).length;

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 2 }}>
        Bumalik
      </Button>
      <LoanHeader
        loan={loan}
        action={
          loan.isActive && (
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploading(true)} sx={{ display: { xs: "none", sm: "flex" } }}>
              Upload Payment
            </Button>
          )
        }
      />
      {loan.isActive && (
        <Button fullWidth variant="contained" size="large" startIcon={<CloudUpload />} onClick={() => setUploading(true)} sx={{ mb: 2, display: { sm: "none" } }}>
          Upload Payment
        </Button>
      )}
      {pendingCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          May {pendingCount} payment na naghihintay ng approval. Ibabawas ito sa balance mo kapag na-approve na.
        </Alert>
      )}
      <LoanSummary loan={loan} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
        Payment Schedule
      </Typography>
      <ScheduleTable loan={loan} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
        Payments
      </Typography>
      {payments.isPending ? <Loading /> : <PaymentHistory payments={payments.data ?? []} />}
      {uploading && <UploadPaymentDialog loan={loan} open onClose={() => setUploading(false)} />}
    </Paper>
  );
}

function MyLoansView() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMyBorrower();
  const loans = useMyLoans();

  if (me.isPending || loans.isPending) return <Loading />;

  if (!me.data) return <NotLinkedCard />;

  const all = loans.data ?? [];
  const selected = all.find((l) => l.id === params.get("id"));
  if (selected) return <MyLoanDetails loan={selected} onBack={() => router.replace("/my-loans")} />;

  const totalBalance = all.filter((l) => l.isActive).reduce((s, l) => s + l.balance, 0);
  return (
    <>
      <PageHeader title={`Hi, ${me.data.name.split(" ")[0]}!`} subtitle={`Kabuuang balance: ${formatPeso(totalBalance)}`} />
      <ErrorAlert error={loans.error} />
      {all.length === 0 ? (
        <Paper>
          <EmptyState>
            Wala kang loan ngayon. <Link href="/request">Mag-request ng loan</Link>
          </EmptyState>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr" } }}>
          {all.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onOpen={() => router.push(`/my-loans?id=${loan.id}`)} />
          ))}
        </Box>
      )}
    </>
  );
}

export default function MyLoansPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyLoansView />
    </Suspense>
  );
}
