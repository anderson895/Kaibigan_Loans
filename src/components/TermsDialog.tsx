"use client";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useLenderContact } from "@/hooks/queries";
import { DEFAULT_LENDER_PHONE } from "@/services/LenderContactService";

/** Bump this when the terms change; it is shown in the dialog. */
const TERMS_LAST_UPDATED = "October 1, 2026";

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 1, fontSize: 18 }}>
        {n}. {title}
      </Typography>
      <Box sx={{ color: "text.secondary", lineHeight: 1.8, "& li": { mb: 0.75 }, "& ul": { pl: 3, my: 1 } }}>{children}</Box>
    </Box>
  );
}

/** The full Terms and Conditions text (including the privacy notice). */
function TermsContent() {
  const { data: lender } = useLenderContact();
  const phone = lender?.phone ?? DEFAULT_LENDER_PHONE;

  return (
    <>
      <Typography sx={{ lineHeight: 1.8 }}>
        Welcome to <strong>Kaibigan Loans</strong> (&quot;the App&quot;). The App is a simple record-keeping tool for
        personal loans between friends: the lender (&quot;Lender&quot;) records loans, and borrowers (&quot;Borrower&quot;,
        &quot;you&quot;) view their balance and upload proof of payment. By creating an account or signing in, you agree to
        these Terms and Conditions. If you do not agree, please do not use the App.
      </Typography>

      <Section n={1} title="Who can use the App">
        <ul>
          <li>You must be at least 18 years old and able to enter into a binding agreement.</li>
          <li>You must give accurate information (your real name and an email address you own).</li>
          <li>Your account is personal. Do not share your password or let others use your account.</li>
        </ul>
      </Section>

      <Section n={2} title="The App is a record-keeping tool, not a bank">
        <ul>
          <li>
            Kaibigan Loans is <strong>not a bank, lending company or financing company</strong>. It does not hold,
            transfer or lend money. All money is sent directly between you and the Lender (e.g. via GCash or a bank).
          </li>
          <li>
            Each loan is a <strong>private agreement between you and the Lender</strong>, usually arranged through
            Messenger, email, SMS or in person. The App only records the terms you both agreed on.
          </li>
          <li>Creating an account does not guarantee that a loan will be approved. The Lender decides whether to lend.</li>
        </ul>
      </Section>

      <Section n={3} title="Loan terms, interest and schedule">
        <ul>
          <li>
            The amount, interest (if any), payment plan (one-time or installments) and due dates are agreed with the Lender
            and shown in <strong>My Loans</strong> together with the payment schedule.
          </li>
          <li>Interest is either a fixed amount, a percentage per period, or none — as agreed per loan and shown before or when the loan is recorded.</li>
          <li>
            The Lender may correct a loan&apos;s terms only before any payment has been approved, and only to reflect what
            you both agreed. If you see terms you did not agree to, contact the Lender right away.
          </li>
          <li>When the Lender sends the money, a proof of send (screenshot) may be attached to your loan.</li>
        </ul>
      </Section>

      <Section n={4} title="Payments">
        <ul>
          <li>You agree to pay each amount on or before its due date, to the account the Lender gave you.</li>
          <li>
            After paying, upload a clear screenshot of the <strong>completed</strong> transaction (with the reference
            number). Uploading fake, edited or someone else&apos;s receipts is prohibited and may be reported to the authorities.
          </li>
          <li>
            A payment is deducted from your balance <strong>only after the Lender approves it</strong>. The Lender may
            reject an unclear or unverifiable receipt and will show the reason.
          </li>
          <li>Receipt reading (OCR) is automatic and may make mistakes; the amount the Lender approves is final.</li>
          <li>An unpaid installment past its due date is marked <strong>Overdue</strong>.</li>
        </ul>
      </Section>

      <Section n={5} title="Your responsibilities">
        <ul>
          <li>Keep your login details safe and tell the Lender if you think your account was used by someone else.</li>
          <li>Do not misuse the App: no false information, no attempts to access other people&apos;s data, no interfering with the service.</li>
          <li>Keep your own copies of receipts. The App is a convenience, not your only record.</li>
        </ul>
      </Section>

      <Section n={6} title="Privacy and your data">
        <Typography sx={{ color: "inherit", lineHeight: 1.8 }}>
          We handle personal data in line with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.
        </Typography>
        <ul>
          <li>
            <strong>What we collect:</strong> your name, email address, profile photo (if you sign in with Google), phone
            and payout details you or the Lender provide, your loans and schedules, and the receipt images you upload.
          </li>
          <li>
            <strong>Why:</strong> to create your account, verify your email, record and display your loans, and process
            your payments. We do not sell your data or use it for advertising.
          </li>
          <li>
            <strong>Who can see it:</strong> only you and the Lender (and authorized admins). Data is stored with
            service providers we use to run the App — Google Firebase (accounts and database), Cloudinary (receipt
            images), Cloudflare (hosting) and Gmail (verification emails).
          </li>
          <li>
            <strong>How long:</strong> while your account is active and for as long as needed to keep accurate records of
            loans and payments, after which it may be deleted.
          </li>
          <li>
            <strong>Your rights:</strong> you may ask to access, correct or delete your personal data, subject to records
            that must be kept for loans that are still outstanding. Contact the Lender using the details below.
          </li>
        </ul>
      </Section>

      <Section n={7} title="Availability and liability">
        <ul>
          <li>The App is provided &quot;as is&quot;. We try to keep it available and accurate but cannot guarantee it will always be error-free or online.</li>
          <li>
            The App is not responsible for the loan agreement itself or for disputes between you and the Lender. Disputes
            should be settled directly and in good faith between you and the Lender.
          </li>
        </ul>
      </Section>

      <Section n={8} title="Suspension and closing your account">
        <ul>
          <li>The Lender may suspend or remove an account that breaks these terms.</li>
          <li>You may ask to close your account at any time. Closing an account does not cancel any unpaid balance.</li>
        </ul>
      </Section>

      <Section n={9} title="Changes to these terms">
        <Typography sx={{ color: "inherit", lineHeight: 1.8 }}>
          We may update these terms. The date at the top shows the latest version. Continuing to use the App after an
          update means you accept the updated terms.
        </Typography>
      </Section>

      <Section n={10} title="Governing law and contact">
        <Typography sx={{ color: "inherit", lineHeight: 1.8 }}>
          These terms are governed by the laws of the Republic of the Philippines. For questions, requests about your data,
          or concerns, contact the Lender:
        </Typography>
        <ul>
          {lender?.email && (
            <li>
              Email: <MuiLink href={`mailto:${lender.email}`}>{lender.email}</MuiLink>
            </li>
          )}
          <li>Phone / SMS: {phone}</li>
          {lender?.messengerUrl && (
            <li>
              Messenger:{" "}
              <MuiLink href={lender.messengerUrl} target="_blank" rel="noopener">
                {lender.messengerUrl.replace(/^https?:\/\//, "")}
              </MuiLink>
            </li>
          )}
        </ul>
      </Section>

      <Divider sx={{ my: 4 }} />
      <Typography variant="body2" color="text.secondary">
        Buod (Summary): Ang Kaibigan Loans ay talaan lang ng mga utang sa pagitan ng magkakaibigan — hindi ito bangko. Ang
        mga terms ng utang ay pinagkasunduan ninyo ng nagpautang. Magbayad sa takdang petsa at mag-upload ng totoong
        resibo. Ikaw at ang nagpautang lang ang nakakakita ng iyong impormasyon, ayon sa Data Privacy Act.
      </Typography>
    </>
  );
}

/**
 * Terms and Conditions as a popup. Pass `onAgree` (sign-up) to show an "I Agree" button
 * that accepts the terms; without it the dialog is read-only.
 */
export function TermsDialog({ open, onClose, onAgree }: { open: boolean; onClose: () => void; onAgree?: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ pb: 0.5 }}>
        Terms and Conditions
        <Typography variant="body2" color="text.secondary">
          Last updated: {TERMS_LAST_UPDATED}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <TermsContent />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{onAgree ? "Cancel" : "Close"}</Button>
        {onAgree && (
          <Button
            variant="contained"
            onClick={() => {
              onAgree();
              onClose();
            }}
            sx={{ borderRadius: 99, px: 3 }}
          >
            I Agree
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
