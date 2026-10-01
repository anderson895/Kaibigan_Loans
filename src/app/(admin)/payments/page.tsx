"use client";
import WarningAmber from "@mui/icons-material/WarningAmber";
import {
  Avatar,
  Button,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import { ReviewPaymentDialog } from "@/components/PaymentDialogs";
import { EmptyState, ErrorAlert, Loading, NameCell, PageHeader, StatusChip } from "@/components/ui";
import { formatDate } from "@/domain/dates";
import { formatPeso } from "@/domain/money";
import type { Payment, PaymentStatus } from "@/domain/Payment";
import { usePayments } from "@/hooks/queries";

export default function PaymentsPage() {
  const { data = [], isPending, error } = usePayments();
  const [tab, setTab] = useState<PaymentStatus>("pending");
  const [reviewing, setReviewing] = useState<Payment | null>(null);
  const rows = data.filter((p) => p.status === tab);
  const count = (s: PaymentStatus) => data.filter((p) => p.status === s).length;

  return (
    <>
      <PageHeader title="Payments" subtitle="I-approve ang mga na-upload na payment. Automatic itong ibabawas sa balance." />
      <Paper sx={{ p: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="pending" label={`Pending (${count("pending")})`} />
          <Tab value="approved" label={`Approved (${count("approved")})`} />
          <Tab value="rejected" label={`Rejected (${count("rejected")})`} />
        </Tabs>
        <ErrorAlert error={error} />
        {isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState>Walang {tab} na payment.</EmptyState>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Receipt</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>OCR Amount</TableCell>
                  <TableCell>Ref No.</TableCell>
                  <TableCell>Paid On</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} hover onClick={() => setReviewing(p)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      <Avatar variant="rounded" src={p.receiptUrl} sx={{ width: 44, height: 44 }} />
                    </TableCell>
                    <TableCell>
                      <NameCell name={p.borrowerName} sub={p.borrowerEmail} />
                    </TableCell>
                    <TableCell>{formatPeso(p.amount)}</TableCell>
                    <TableCell>
                      {p.ocr?.amount != null ? formatPeso(p.ocr.amount) : "-"}
                      {p.hasOcrMismatch && (
                        <Tooltip title="Hindi tugma sa declared amount">
                          <WarningAmber color="warning" fontSize="small" sx={{ ml: 0.5, verticalAlign: "middle" }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>{p.referenceNo || "-"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(p.paidOn)}</TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant={p.isPending ? "contained" : "outlined"}>
                        {p.isPending ? "Review" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <ReviewPaymentDialog payment={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}
