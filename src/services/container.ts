import { ActivityRepository, BorrowerRepository, LoanRepository, PaymentRepository } from "@/data/repositories";
import { auth, db } from "@/lib/firebase";
import { AuthService } from "./AuthService";
import { LenderContactService } from "./LenderContactService";
import { LoanService } from "./LoanService";
import { OcrService } from "./OcrService";
import { PaymentService } from "./PaymentService";
import { UploadService } from "./UploadService";

/** Composition root: wires repositories and services once for the client app. */
const loanRepo = new LoanRepository(db);
const borrowerRepo = new BorrowerRepository(db);
const paymentRepo = new PaymentRepository(db);
const activityRepo = new ActivityRepository(db);

export const authService = new AuthService(auth, db);
export const uploadService = new UploadService(authService);
export const ocrService = new OcrService();
export const lenderContactService = new LenderContactService(db);
export const loanService = new LoanService(db, loanRepo, borrowerRepo, activityRepo, uploadService);
export const paymentService = new PaymentService(db, paymentRepo, loanRepo, activityRepo, uploadService);
