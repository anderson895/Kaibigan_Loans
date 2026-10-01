"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Borrower, BorrowerInput } from "@/domain/Borrower";
import type { Loan } from "@/domain/Loan";
import { useAuth } from "@/components/AuthProvider";
import type { LoanTermsInput } from "@/services/LoanService";
import type { SubmitPaymentInput } from "@/services/PaymentService";
import { authService, lenderContactService, loanService, paymentService } from "@/services/container";

export const keys = {
  loans: ["loans"] as const,
  myLoans: (email: string) => ["loans", "mine", email] as const,
  loan: (id: string) => ["loans", "one", id] as const,
  borrowers: ["borrowers"] as const,
  me: (email: string) => ["borrowers", "me", email] as const,
  payments: ["payments"] as const,
  loanPayments: (loanId: string) => ["payments", "loan", loanId] as const,
  activity: ["activity"] as const,
  admins: ["admins"] as const,
  lenderContact: ["lenderContact"] as const,
};

// ---- Queries ----

export const useLoans = () => useQuery({ queryKey: keys.loans, queryFn: () => loanService.listLoans() });

export function useMyLoans() {
  const { email } = useAuth();
  return useQuery({ queryKey: keys.myLoans(email), queryFn: () => loanService.listMyLoans(email), enabled: !!email });
}

export const useLoan = (id: string | null) =>
  useQuery({ queryKey: keys.loan(id ?? ""), queryFn: () => loanService.getLoan(id!), enabled: !!id });

export const useBorrowers = () => useQuery({ queryKey: keys.borrowers, queryFn: () => loanService.listBorrowers() });

/** The borrower record linked to the signed-in Google account. */
export function useMyBorrower() {
  const { email } = useAuth();
  return useQuery({ queryKey: keys.me(email), queryFn: () => loanService.findBorrowerByEmail(email), enabled: !!email });
}

export const usePayments = () => useQuery({ queryKey: keys.payments, queryFn: () => paymentService.listAll() });

export function useLoanPayments(loanId: string | null, asBorrower = false) {
  const { email } = useAuth();
  return useQuery({
    queryKey: keys.loanPayments(loanId ?? ""),
    queryFn: () => paymentService.listForLoan(loanId!, asBorrower ? email : undefined),
    enabled: !!loanId,
  });
}

export const useActivity = () => useQuery({ queryKey: keys.activity, queryFn: () => loanService.recentActivity(8) });

export const useLenderContact = () =>
  useQuery({ queryKey: keys.lenderContact, queryFn: () => lenderContactService.get() });

export function useSaveLenderContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { messenger: string; email: string; phone: string }) => lenderContactService.save(input),
    onSuccess: () => invalidate(keys.lenderContact),
  });
}

export const useAdmins = () => useQuery({ queryKey: keys.admins, queryFn: () => authService.listAdmins() });

// ---- Mutations ----

function useInvalidate() {
  const qc = useQueryClient();
  return (...prefixes: (readonly string[])[]) =>
    Promise.all(prefixes.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useCreateBorrower() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: BorrowerInput) => loanService.createBorrower(input),
    onSuccess: () => invalidate(keys.borrowers),
  });
}

export function useUpdateBorrower() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ borrower, changes }: { borrower: Borrower; changes: Partial<BorrowerInput> }) =>
      loanService.updateBorrower(borrower, changes),
    onSuccess: () => invalidate(keys.borrowers),
  });
}

export function useDeleteBorrower() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => loanService.deleteBorrower(id), onSuccess: () => invalidate(keys.borrowers) });
}

interface ProofOfSend {
  file: File;
  referenceNo: string;
  sentOn: string;
}

export function useCreateLoan() {
  const { email } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      borrower,
      terms,
      proof,
    }: {
      borrower: Borrower;
      terms: LoanTermsInput & { amountPaid?: number };
      proof?: ProofOfSend | null;
    }) => {
      const id = await loanService.createLoan(borrower, terms, email);
      if (proof) {
        const loan = await loanService.getLoan(id);
        if (loan) await loanService.attachDisbursement(loan, proof, email);
      }
      return id;
    },
    onSuccess: () => invalidate(keys.loans, keys.activity),
  });
}

export function useAttachDisbursement() {
  const { email } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ loan, ...proof }: ProofOfSend & { loan: Loan }) => loanService.attachDisbursement(loan, proof, email),
    onSuccess: () => invalidate(keys.loans, keys.activity),
  });
}

export function useRequestLoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: Parameters<typeof loanService.requestLoan>) => loanService.requestLoan(...args),
    onSuccess: () => invalidate(keys.loans),
  });
}

export function useReviewRequest() {
  const { email } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ loan, terms }: { loan: Loan; terms: LoanTermsInput | null }) =>
      terms ? loanService.approveRequest(loan, terms, email) : loanService.rejectRequest(loan, email),
    onSuccess: () => invalidate(keys.loans, keys.activity),
  });
}

export function useUpdateLoanTerms() {
  const { email } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ loan, terms }: { loan: Loan; terms: LoanTermsInput }) => loanService.updateLoanTerms(loan, terms, email),
    onSuccess: () => invalidate(keys.loans, keys.activity),
  });
}

export function useDeleteLoan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => loanService.deleteLoan(id), onSuccess: () => invalidate(keys.loans) });
}

export function useSubmitPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: SubmitPaymentInput) => paymentService.submit(input),
    onSuccess: () => invalidate(keys.payments, keys.activity),
  });
}

export function useReviewPayment() {
  const { email } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { id: string; action: "approve"; amount?: number } | { id: string; action: "reject"; reason: string }) =>
      args.action === "approve"
        ? paymentService.approve(args.id, email, args.amount)
        : paymentService.reject(args.id, args.reason, email),
    onSuccess: () => invalidate(keys.payments, keys.loans, keys.activity),
  });
}

export function useAdminMutations() {
  const invalidate = useInvalidate();
  const add = useMutation({ mutationFn: (email: string) => authService.addAdmin(email), onSuccess: () => invalidate(keys.admins) });
  const remove = useMutation({ mutationFn: (email: string) => authService.removeAdmin(email), onSuccess: () => invalidate(keys.admins) });
  return { add, remove };
}
