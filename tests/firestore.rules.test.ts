/**
 * Security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const user = (email: string) =>
  env.authenticatedContext(email.split("@")[0], { email, email_verified: true }).firestore();

const ADMIN = "admin@gmail.com";
const ANNA = "anna@gmail.com";
const MARK = "mark@gmail.com";

const loan = (email: string, borrowerId: string, extra = {}) => ({
  borrowerId,
  borrowerEmail: email,
  borrowerName: email,
  principal: 5000,
  interestType: "none",
  amountPaid: 0,
  balance: 5000,
  status: "ongoing",
  createdAt: 1,
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-kaibigan",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "meta/setup"), { owner: ADMIN });
    await setDoc(doc(db, "admins", ADMIN), { email: ADMIN });
    await setDoc(doc(db, "borrowers/anna"), { name: "Anna", email: ANNA });
    await setDoc(doc(db, "borrowers/mark"), { name: "Mark", email: MARK });
    await setDoc(doc(db, "loans/annaLoan"), loan(ANNA, "anna"));
    await setDoc(doc(db, "loans/markLoan"), loan(MARK, "mark"));
    await setDoc(doc(db, "payments/annaPay"), { loanId: "annaLoan", borrowerEmail: ANNA, amount: 100, status: "pending" });
  });
}

describe("first admin setup", () => {
  it("first user can claim admin once", async () => {
    const db = user(ADMIN);
    const batch = writeBatch(db);
    batch.set(doc(db, "admins", ADMIN), { email: ADMIN });
    batch.set(doc(db, "meta/setup"), { owner: ADMIN });
    await assertSucceeds(batch.commit());

    const other = user(ANNA);
    const again = writeBatch(other);
    again.set(doc(other, "admins", ANNA), { email: ANNA });
    again.set(doc(other, "meta/setup"), { owner: ANNA });
    await assertFails(again.commit());
  });

  it("cannot claim admin without the setup marker", async () => {
    const db = user(ANNA);
    await assertFails(setDoc(doc(db, "admins", ANNA), { email: ANNA }));
  });
});

describe("borrower access", () => {
  beforeEach(seed);

  it("reads own loan but not someone else's", async () => {
    const db = user(ANNA);
    await assertSucceeds(getDoc(doc(db, "loans/annaLoan")));
    await assertFails(getDoc(doc(db, "loans/markLoan")));
    await assertSucceeds(getDocs(query(collection(db, "loans"), where("borrowerEmail", "==", ANNA))));
    await assertFails(getDocs(collection(db, "loans")));
  });

  it("cannot change a loan balance or approve a payment", async () => {
    const db = user(ANNA);
    await assertFails(updateDoc(doc(db, "loans/annaLoan"), { balance: 0 }));
    await assertFails(updateDoc(doc(db, "payments/annaPay"), { status: "approved" }));
  });

  it("submits a pending payment only for own active loan", async () => {
    const db = user(ANNA);
    const payment = { loanId: "annaLoan", borrowerEmail: ANNA, amount: 1200, status: "pending", reviewedAt: null };
    await assertSucceeds(setDoc(doc(db, "payments/p1"), payment));
    await assertFails(setDoc(doc(db, "payments/p2"), { ...payment, status: "approved" }));
    await assertFails(setDoc(doc(db, "payments/p3"), { ...payment, loanId: "markLoan" }));
  });

  it("can request a loan for self only, as pending with no interest", async () => {
    const db = user(ANNA);
    await assertSucceeds(setDoc(doc(db, "loans/r1"), loan(ANNA, "anna", { status: "pending" })));
    await assertFails(setDoc(doc(db, "loans/r2"), loan(ANNA, "anna", { status: "ongoing" })));
    await assertFails(setDoc(doc(db, "loans/r3"), loan(ANNA, "mark", { status: "pending" })));
  });

  it("cannot read admin-only activity or other borrowers", async () => {
    const db = user(ANNA);
    await assertFails(getDocs(collection(db, "activity")));
    await assertFails(getDoc(doc(db, "borrowers/mark")));
    await assertSucceeds(getDoc(doc(db, "borrowers/anna")));
  });
});

describe("admin access", () => {
  beforeEach(seed);

  it("reads everything and approves payments", async () => {
    const db = user(ADMIN);
    await assertSucceeds(getDocs(collection(db, "loans")));
    await assertSucceeds(updateDoc(doc(db, "payments/annaPay"), { status: "approved" }));
    await assertSucceeds(updateDoc(doc(db, "loans/annaLoan"), { balance: 4900, amountPaid: 100 }));
    await assertSucceeds(setDoc(doc(db, "admins", MARK), { email: MARK }));
  });
});
