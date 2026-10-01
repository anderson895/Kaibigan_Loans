# Kaibigan Loans

> *Tulong sa mga Kaibigan*: isang simpleng loan tracker para sa pagpapautang sa mga kaibigan.

Kapalit ito ng mano-manong paglilista sa Word (Name, Credit, Interest, Balance, Total, Due Date):

- **Ikaw (admin):** naglilista ng utang gamit ang form. Automatic ang compute ng tubo, total, balance at payment schedule.
- **Borrower:** nagla-login gamit ang Google, nakikita ang sariling balance at schedule, at nag-a-upload ng screenshot ng bayad.
- **OCR:** binabasa ng system ang amount at reference no. mula sa screenshot (GCash, Maya, bank).
- **Approve:** kapag in-approve mo ang bayad, awtomatiko itong ibinabawas sa balance, at makikita agad ito ng borrower.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Paano gumagana (Flow)](#paano-gumagana-flow)
4. [Setup (unang beses)](#setup-unang-beses)
5. [Development](#development)
6. [Deployment sa Cloudflare](#deployment-sa-cloudflare)
7. [Architecture at Project Structure](#architecture-at-project-structure)
8. [Data Model](#data-model)
9. [Pag-compute ng Tubo at Balance](#pag-compute-ng-tubo-at-balance)
10. [OCR ng Resibo](#ocr-ng-resibo)
11. [Security](#security)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)

---

## Features

### Admin
| Page | Ano ang laman |
|---|---|
| **Dashboard** | Total Borrowers, Total Loaned, Interest Earned, Pending Payments, Recent Loans, Recent Activity |
| **Loans** | Search at status filter, **+ New Loan** (may live preview ng total at schedule), Loan Details (summary, schedule, payments), review ng loan request |
| **Payments** | Pending, Approved at Rejected tabs, resibo, OCR amount, mismatch warning, **Approve & deduct** o **Reject** (may dahilan) |
| **Borrowers** | Lahat ng nag-register (kusang nadadagdag pagka-verify ng email), phone, saan ipapadala ang pera, active loans, outstanding, at **New Loan** button |
| **Reports** | Total lent, interest, collected, outstanding, per-month na buod, **Export CSV** |
| **Settings** | Magdagdag o magtanggal ng ibang admin |

### Borrower (mobile-friendly)
| Page | Ano ang laman |
|---|---|
| **My Loans** | Current balance, next due, status, schedule, payment history (kasama ang dahilan kapag na-reject) |
| **Upload Payment** | Screenshot, auto-fill ng amount at ref no. gamit ang OCR, at petsa ng bayad |
| **Request Loan** | Amount, hulugan o isang bagsak, ilang buwan, at saan ipapadala ang pera |

### Status ng Loan
| Status | Kahulugan |
|---|---|
| `Pending` | Loan request ng borrower na hindi pa na-approve |
| `On Going` | Aktibong utang |
| `Overdue` | May hulog na lampas na sa due date at hindi pa bayad (automatic) |
| `Paid` | Zero na ang balance |
| `Rejected` | Tinanggihang request |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, **Material UI v9**, Material Icons, **TanStack Query v5** |
| Framework / Backend | **Next.js 15** (App Router, Route Handlers) |
| Database / Auth | **Firebase** Firestore at Firebase Auth (Google Sign-in) |
| File storage | **Cloudinary** (signed upload ng resibo) |
| OCR | **tesseract.js** (tumatakbo sa browser, libre) |
| Deployment | **Cloudflare Pages** (static export + Pages Function) |
| Tests | Vitest, `@firebase/rules-unit-testing` at Firestore Emulator |
| Paradigm | **OOP**: domain classes, repositories, services, strategy pattern |

---

## Paano gumagana (Flow)

```
 Borrower                         System                               Admin (ikaw)
 ────────                         ──────                               ────────────
 Request Loan ─────────────────►  loan (status: pending) ───────────►  Review Request
                                                                       (i-set ang tubo/term → Approve)
                                  loan (status: ongoing) + schedule ◄─┘
                                                                       Ipadala ang pera (GCash/bank)
 Upload screenshot ──► OCR ──►    payment (status: pending) ─────────►  Payments → Review
   (auto-fill amount/ref)                                              (tingnan ang OCR vs declared)
                                                                       Approve & deduct
                                  transaction:                     ◄──┘
                                   • payment → approved
                                   • loan.amountPaid += amount
                                   • balance = total − amountPaid
                                   • schedule items → paid
 Makikita ang bagong balance ◄──  • status → paid kapag 0 na
```

Pwede ka pa ring gumawa ng loan nang direkta (**Loans → + New Loan**) para sa mga nag-message sa Messenger.

---

## Setup (unang beses)

### 1. Requirements
- Node.js 20+ (na-test sa v22)
- Java 11+ (para lang sa Firestore emulator tests)
- Firebase project (`basiclendingapp`) at Cloudinary account

### 2. Install
```bash
npm install
```

### 3. Environment variables
Kopyahin ang `.env.example` papuntang `.env.local` at punan:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=basiclendingapp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=basiclendingapp
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=basiclendingapp.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=   # ← makikita sa Cloudinary Dashboard
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...            # SERVER ONLY. Huwag lagyan ng NEXT_PUBLIC_
```

> ⚠️ Ang `NEXT_PUBLIC_*` ay makikita ng browser. Ligtas iyon para sa Firebase web config dahil ang Firestore rules ang nagpoprotekta sa data. **Hindi** ligtas iyon para sa `CLOUDINARY_API_SECRET`.

### 4. Firebase Console
1. **Authentication → Sign-in method →** i-enable ang **Google** at **Email/Password**.
2. **Authentication → Settings → Authorized domains →** idagdag ang production domain mo (`kaibigan-loans.pages.dev`).
3. **Firestore Database →** Create database (production mode).
4. I-deploy ang security rules at indexes:
   ```bash
   npx firebase login
   npm run deploy:rules
   ```

### 5. Cloudinary
- Kunin ang **Cloud name** sa Dashboard at ilagay sa `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
- Hindi na kailangan ang unsigned preset (`basicLendingUpload`). **Signed upload** na ang gamit ng app. Pwede mo na itong burahin o gawing *signed* para hindi magamit ng iba.

### 6. Unang admin
1. Patakbuhin ang app at mag-**Sign in with Google** gamit ang account mo.
2. Lalabas ang **First-time setup**. I-click ang **"Oo, ako ang admin"**.
3. Isang beses lang ito pwedeng gawin. Pagkatapos, sa **Settings** na lang magdadagdag ng ibang admin.

### 7. Pag-add ng borrower
1. Ipa-register ang kaibigan mo sa site (email at password, o Google), at ipa-verify ang email niya.
2. Kusa siyang lalabas sa **Borrowers**. I-click ang **New Loan** sa tabi ng pangalan niya.
3. Pagkatapos ipadala ang pera, i-upload ang screenshot bilang **Proof of Send** (sa New Loan o sa Loan Details). Makikita ito ng borrower.
3. Para sa mga lumang record mula sa Word: **Loans → + New Loan**, at ilagay ang **"Nabayaran na (lumang record)"** para tama ang balance.

---

## Development

| Command | Ginagawa |
|---|---|
| `npm run dev` | Dev server sa http://localhost:3000 |
| `npm run build` | Next.js production build |
| `npm run lint` | TypeScript type check |
| `npm test` | Unit tests (domain logic at OCR parser) |
| `npm run test:rules` | Firestore security rules tests (sinisimulan ang emulator) |
| `npm run preview` | Build at patakbuhin ang Pages site + Function nang local |
| `npm run deploy` | Manual na build at deploy sa Cloudflare Pages |
| `npm run deploy:rules` | I-deploy ang `firestore.rules` at indexes |

---

## Deployment sa Cloudflare Pages

Live: **https://kaibigan-loans.pages.dev**

- Ang site ay **static export** (`next build` → `out/`), dahil tumatakbo sa browser ang lahat ng page.
- Ang tanging server code, ang Cloudinary upload signature, ay **Pages Function** sa `functions/api/upload-signature.ts`. Ang logic nito ay nasa `src/server/uploadSignature.ts`, at ginagamit din ng `src/app/api/upload-signature/route.dev.ts` para gumana sa `npm run dev`.
- **Auto-deploy:** naka-connect ang Pages project sa GitHub, kaya bawat `git push` sa `main` ay nagbi-build at nagde-deploy.

**Pages project settings (isang beses lang):**
| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `out` |
| Production branch | `main` |

**Secrets (isang beses lang)** — `npx wrangler pages secret put <NAME> --project-name kaibigan-loans`:
| Secret | Para saan |
|---|---|
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Pag-upload ng resibo at proof of send |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Service account: paggawa ng verification at password-reset links |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Pagpapadala ng account emails mula sa Gmail (App Password) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (bot check) |

Ang `FIREBASE_PROJECT_ID` at `CLOUDINARY_CLOUD_NAME` ay nasa `vars` ng `wrangler.jsonc`. Ang `NEXT_PUBLIC_*` para sa browser (kasama ang `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) ay nasa `.env.production`.

> Kapag binago ang isang secret, magkakabisa ito sa **susunod na deploy** (push o Retry deployment).

**Account emails (verification at forgot password):**
- Sariling template at sariling pages (`/verify-email`, `/reset-password`); hindi Firebase ang nagpapadala. Gumagawa lang ang Firebase ng action code gamit ang service account (`src/server/firebaseAdmin.ts`).
- Pagpapadala sa **Gmail SMTP**: sa Cloudflare, gamit ang native sockets (`worker-mailer`, `src/server/mail-worker.ts`); sa `npm run dev`, gamit ang **Nodemailer** (`src/server/mail-node.ts`). Hindi gumagana ang Nodemailer sa Pages Functions dahil walang Node `net`/`tls` doon.
- Ang forgot password ay laging sumasagot ng "sent" (kahit walang account) para hindi malaman ng iba kung sino ang may account.

**Cloudflare Turnstile:** widget na "Kaibigan Loans" (domains: `kaibigan-loans.pages.dev`, `localhost`). Sa sign up, resend link at forgot password, vine-verify ito **sa server** bago magpadala ng email. Sa login, sa browser lang ito chine-check, dahil diretso sa Firebase ang login.

**Firebase:** idagdag ang `kaibigan-loans.pages.dev` sa **Authentication → Settings → Authorized domains**.

**Local na test ng production build:** `npm run preview`. Kailangan ng `.dev.vars` (naka-gitignore) na may parehong secrets sa itaas.

## Architecture at Project Structure

```
Browser (Next.js client, MUI, TanStack Query)
   │  Firebase JS SDK ── Auth (Google) + Firestore (protektado ng firestore.rules)
   │  tesseract.js ───── OCR ng resibo (sa browser)
   │  Upload ────────────► Cloudinary (signed upload)
   ▼
Next.js Route Handler (Cloudflare Worker)
   └─ POST /api/upload-signature → vine-verify ang Firebase ID token (jose + Google JWKS)
                                   → nagbabalik ng Cloudinary signature (nasa server lang ang secret)
```

```
src/
├── domain/               # Purong business logic (walang Firebase) ← dito ang mga tests
│   ├── Loan.ts           # create, buildSchedule, applyPayment, statusOn, approve/rejectRequest
│   ├── InterestStrategy.ts  # Strategy pattern: FixedInterest, PercentMonthlyInterest, NoInterest
│   ├── Payment.ts        # submit, approve(amount), reject(reason), hasOcrMismatch
│   ├── Borrower.ts
│   ├── ReceiptParser.ts  # Kumukuha ng amount at ref no. mula sa OCR text
│   ├── money.ts, dates.ts
├── data/                 # Repositories (Firestore ↔ domain objects)
│   ├── BaseRepository.ts # Generic CRUD<TEntity, TProps>
│   └── repositories.ts   # Loan/Borrower/Payment/Activity repositories
├── services/             # Use cases
│   ├── LoanService.ts    # borrowers, createLoan, requestLoan, approve/rejectRequest
│   ├── PaymentService.ts # submit (upload + save), approve (transaction), reject
│   ├── UploadService.ts  # Cloudinary signed upload
│   ├── OcrService.ts     # tesseract.js + ReceiptParser
│   ├── AuthService.ts    # Google sign-in, roles, admins
│   └── container.ts      # Composition root (dito naka-wire ang lahat)
├── hooks/queries.ts      # TanStack Query hooks (useLoans, useReviewPayment, ...)
├── components/           # MUI components (AppShell, LoansTable, dialogs, ...)
├── lib/                  # firebase.ts, theme.ts
└── app/
    ├── (admin)/          # dashboard, loans, payments, borrowers, reports, settings
    ├── (borrower)/       # my-loans, request
    ├── login/
    └── api/upload-signature/route.ts
public/images/            # Images na sine-serve ng site (WebP, naka-optimize)
├── landing/hero-dashboard.webp
└── login/coins.webp
assets/images/            # High-res originals — dito i-regenerate ang mga WebP sa public/
src/app/icon.png          # Favicon (tab bar); src/app/apple-icon.png para sa phone home screen
src/lib/assets.ts         # Iisang listahan ng image paths na ginagamit sa code
firestore.rules           # Security rules (ang tunay na proteksyon)
tests/firestore.rules.test.ts
```

**Mga prinsipyo:**
- Ang **domain classes ay immutable**. Ang `loan.applyPayment()` ay nagbabalik ng *bagong* `Loan`, kaya madaling i-test.
- Ang **balance ay laging galing sa computation** (`total − amountPaid`) at hindi ine-edit nang direkta.
- Ang UI ay tumatawag lang sa **hooks → services → repositories**.

---

## Data Model

| Collection | Fields |
|---|---|
| `admins/{email}` | `email, addedAt` |
| `meta/setup` | `owner, at` (marker na may admin na) |
| `borrowers/{id}` | `name, email, phone, payoutDetails, createdAt` |
| `loans/{id}` | `borrowerId, borrowerName, borrowerEmail, principal, interestType, interestValue, term, termUnit (`months`\|`weeks`), paymentPlan, interestAmount, totalAmount, amountPaid, balance, startDate, dueDate, status, schedule[], notes, payoutDetails, createdAt` |
| `payments/{id}` | `loanId, borrowerId, borrowerName, borrowerEmail, amount, referenceNo, paidOn, receiptUrl, receiptPublicId, ocr{amount, referenceNo, text}, status, rejectReason, submittedAt, reviewedAt` |
| `activity/{id}` | `type, message, loanId, borrowerName, amount, actorEmail, createdAt` |

Ang mga petsa ay naka-store bilang `YYYY-MM-DD` string para walang timezone shift.

---

## Pag-compute ng Tubo at Balance

| Uri ng tubo | Formula | Halimbawa (₱5,000, 5 buwan) |
|---|---|---|
| **Walang tubo** | `0` | Total ₱5,000 |
| **Fixed amount** | `interestValue` | ₱1,000 → Total ₱6,000 |
| **% kada buwan/linggo** | `principal × rate% × term` | 4%/buwan → ₱1,000 → Total ₱6,000 |

**Schedule:**
- **Term unit:** pwedeng **Months** o **Weeks**. Halimbawa, ang "1 week, One-time payment" ay babayaran 7 araw pagkatapos ng loan date. Kapag weekly, ang % interest ay kada linggo.
- *Hulugan:* `total ÷ term` kada buwan o kada linggo, simula isang period pagkatapos ng loan date. Ang huling hulog ang sumasalo sa sobra o kulang dahil sa rounding (hal. ₱1,000/3 = 333.33, 333.33, 333.34).
- *Isang bagsak:* isang due date lang, `term` buwan o linggo mula sa loan date.
- Kapag lampas na sa katapusan ng buwan ang due date, ginagamit ang huling araw (Jan 31 + 1 buwan = Feb 28/29).

**Pagbabayad:** Ang approved na bayad ay ina-apply sa pinakalumang hulog muna. Kapag kulang, `Partial` ang status ng hulog na iyon. Kapag sobra, dadaloy ito sa susunod na hulog. Hindi bababa sa ₱0 ang balance.

---

## OCR ng Resibo

1. Pumipili ang borrower ng screenshot at binabasa ito ng **tesseract.js** sa mismong browser (walang bayad at walang API key).
2. Hinahanap ng `ReceiptParser`:
   - **Amount:** mga linyang may *Amount, Total, Amount Sent, Amount Paid* (sa parehong linya o sa kasunod). Kung wala, ang pinakamalaking peso value.
   - **Reference No.:** *Ref No., Reference ID, Transaction No., Trace No.*
3. Awtomatikong napupunan ang form, pero pwede pa itong itama ng borrower.
4. Sa admin **Review Payment**, ipinapakita ang OCR amount at kung **tugma** ito sa declared. Kapag hindi tugma, may button na **"Use ₱X"** para gamitin ang nabasang amount.
5. Sa **Approve & deduct**, ang amount sa field ang ibabawas sa balance.

> Tumutulong ang OCR pero hindi ito perpekto (lalo na kapag malabo o naka-crop ang screenshot). **Ikaw pa rin ang huling magve-verify** bago mag-approve.

---

## Security

- **Login:** Google Sign-in, o email + password (may Remember me at Forgot password). May Cloudflare Turnstile ang login, sign up at forgot password. Ang email/password accounts ay kailangang **i-verify ang email** bago makapasok, para walang makagamit ng email ng ibang tao para makita ang loan nito.
- **Firestore rules** (`firestore.rules`) ang tunay na proteksyon. Ang client-side route guard ay para lang sa UX.
  - Nababasa lang ng borrower ang `loans`, `payments` at `borrowers` na tugma sa **sariling email** niya.
  - Ang kaya lang gawin ng borrower: gumawa ng `pending` na payment para sa *sarili niyang aktibong* loan, at `pending` na loan request (walang tubo, max ₱100,000).
  - **Hindi** kayang baguhin ng borrower ang balance o mag-approve ng payment.
  - Ang unang admin ay isang beses lang ma-claim (`meta/setup`).
- **Cloudinary secret** ay nasa server lang (`/api/upload-signature`). Nagbibigay lang ito ng signature sa mga naka-login na user na verified ang email.
- Ang `.env*` at `api_credentials.txt` ay nasa `.gitignore`.

> ⚠️ **I-rotate ang Cloudinary API Secret** kung na-share o na-upload na kahit saan ang `api_credentials.txt` (Cloudinary → Settings → API Keys → Regenerate). Pagkatapos, i-update ang `.env.local` at ang `wrangler secret`.

---

## Testing

```bash
npm test             # 20 unit tests: interest, schedule, payments, status, OCR parser
npm run test:rules   # 8 security rules tests gamit ang Firestore emulator (kailangan ng Java)
```

**Manual E2E checklist:**
1. Admin: gumawa ng contact at loan na ₱5,000 + ₱1,000 fixed, 5 buwang hulugan. Ang schedule ay dapat 5 × ₱1,200.
2. Borrower (ibang Google account): tingnan ang loan at mag-upload ng ₱1,200 na resibo. Dapat ma-auto-fill ng OCR ang amount.
3. Admin: Payments → Review → **Approve & deduct**. Dapat maging ₱4,800 ang balance at `Paid` ang unang hulog.
4. Borrower: i-refresh. Dapat makita ang ₱4,800.
5. Subukan din ang Reject (may dahilan), Loan Request → Approve, at Overdue (loan na lampas na ang due date).

---

## Troubleshooting

| Problema | Solusyon |
|---|---|
| `auth/unauthorized-domain` sa login | Idagdag ang domain sa Firebase → Authentication → Settings → Authorized domains |
| "Hindi pa naka-link ang account mo" | Idagdag ang eksaktong Gmail ng borrower sa **Contacts** |
| `Upload not allowed (500)` | Kulang ang `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` o `CLOUDINARY_API_SECRET` |
| `Upload not allowed (401)` | Nag-expire ang session. Mag-sign out at mag-sign in ulit |
| Firestore "requires an index" | `npm run deploy:rules` (kasama ang `firestore.indexes.json`) |
| Mabagal ang unang OCR | Normal lang ito: dina-download pa ang OCR model (~10MB) sa unang gamit |

---

## Roadmap (Phase 2)
- CSV import ng lumang records mula sa Word/Excel (sa ngayon: gamitin ang **"Nabayaran na"** field sa New Loan)
- Email o Messenger reminder bago ang due date
- Optional na penalty kapag overdue
- Shareable link ng loan para sa Messenger
