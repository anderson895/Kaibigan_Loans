"use client";
import Google from "@mui/icons-material/Google";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useState, type FormEvent } from "react";
import { UserAvatar } from "@/components/AppShell";
import { Field, PasswordField } from "@/components/AuthForms";
import { useAuth } from "@/components/AuthProvider";
import { Loading, PageHeader } from "@/components/ui";
import { useChangePassword, useMyBorrower, useUpdateName } from "@/hooks/queries";
import { authErrorMessage, MIN_PASSWORD_LENGTH } from "@/services/AuthService";
import { ProfileService } from "@/services/ProfileService";

const SIGN_IN_METHODS: Record<string, string> = { "google.com": "Google", password: "Email & password" };

/** Full width on phones, like the other main buttons. */
const submitSx = { alignSelf: { xs: "stretch", sm: "flex-start" }, minHeight: 42 } as const;

function AccountCard({ name }: { name: string }) {
  const { user, role } = useAuth();
  const methods = [...new Set(user?.providerData.map((p) => SIGN_IN_METHODS[p.providerId] ?? p.providerId) ?? [])];
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <UserAvatar size={64} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            {name || "No name yet"}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
            <Chip size="small" color="primary" label={role === "admin" ? "Admin" : "Borrower"} />
            {methods.map((m) => (
              <Chip key={m} size="small" variant="outlined" label={`Sign-in: ${m}`} />
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function NameCard({ current }: { current: string }) {
  const { role } = useAuth();
  const update = useUpdateName();
  // null = not edited, so the field shows the saved name.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current;
  const changed = value.trim() !== "" && value.trim() !== current;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (changed) update.mutate(value, { onSuccess: () => setDraft(null) });
  };

  return (
    <Paper component="form" onSubmit={submit} noValidate sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6">Name</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {role === "borrower" ? "This is the name your lender sees on your loans." : "Shown in the sidebar and in the audit log."}
      </Typography>
      <Stack spacing={2}>
        <Field
          label="Full Name"
          icon={<PersonOutlined color="action" />}
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            update.reset();
          }}
          autoComplete="name"
        />
        {update.isSuccess && <Alert severity="success">Name updated.</Alert>}
        {update.error && <Alert severity="error">{authErrorMessage(update.error)}</Alert>}
        <Button type="submit" variant="contained" disabled={!changed || update.isPending} sx={submitSx}>
          {update.isPending ? "Saving..." : "Save Name"}
        </Button>
      </Stack>
    </Paper>
  );
}

function PasswordCard() {
  const { user } = useAuth();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== next;
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    change.reset();
  };

  if (!user || !ProfileService.hasPassword(user)) {
    return (
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Password
        </Typography>
        <Alert severity="info" icon={<Google />}>
          You sign in with Google, so there is no password to change here. Manage it in your Google account.
        </Alert>
      </Paper>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  };

  return (
    <Paper component="form" onSubmit={submit} noValidate sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6">Password</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter your current password, then choose a new one.
      </Typography>
      {/* Lets password managers save the new password for the right account. */}
      <input type="email" name="username" autoComplete="username" value={user.email ?? ""} readOnly hidden />
      <Stack spacing={2}>
        <PasswordField label="Current Password" value={current} onChange={edit(setCurrent)} autoComplete="current-password" />
        <PasswordField label="New Password" value={next} onChange={edit(setNext)} autoComplete="new-password" />
        <Box>
          <PasswordField label="Confirm New Password" value={confirm} onChange={edit(setConfirm)} autoComplete="new-password" />
          <Typography variant="caption" color={mismatch ? "error" : "text.secondary"}>
            {mismatch ? "Passwords do not match." : `At least ${MIN_PASSWORD_LENGTH} characters.`}
          </Typography>
        </Box>
        {change.isSuccess && <Alert severity="success">Password changed.</Alert>}
        {change.error && <Alert severity="error">{authErrorMessage(change.error)}</Alert>}
        <Button
          type="submit"
          variant="contained"
          disabled={!current || next.length < MIN_PASSWORD_LENGTH || confirm !== next || change.isPending}
          sx={submitSx}
        >
          {change.isPending ? "Saving..." : "Change Password"}
        </Button>
      </Stack>
    </Paper>
  );
}

/** Any signed-in user (admin or borrower) updates their own name and password here. */
export default function ProfilePage() {
  const { user } = useAuth();
  const me = useMyBorrower();
  if (me.isPending) return <Loading />;
  // For borrowers, the name on their borrower profile is the one the lender sees.
  const name = me.data?.name || user?.displayName || "";

  return (
    <>
      <PageHeader title="My Profile" subtitle="Update your name and password." />
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <AccountCard name={name} />
        <NameCard current={name} />
        <PasswordCard />
      </Stack>
    </>
  );
}
