"use client";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import { Alert, Avatar, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/AppShell";
import { PasswordField } from "@/components/AuthForms";
import { authErrorMessage, MIN_PASSWORD_LENGTH } from "@/services/AuthService";
import { authService } from "@/services/container";

type State =
  | { status: "checking" }
  | { status: "form"; email: string }
  | { status: "done" }
  | { status: "error"; message: string };

/** Landing page for the link in our password-reset email (sent from our Gmail, not by Firebase). */
function ResetPasswordView() {
  const oobCode = useSearchParams().get("oobCode");
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && confirm !== password;

  useEffect(() => {
    if (!oobCode) return setState({ status: "error", message: "Missing reset code. Open the link from your email again." });
    authService
      .checkResetCode(oobCode)
      .then((email) => setState({ status: "form", email }))
      .catch((e) => setState({ status: "error", message: authErrorMessage(e) }));
  }, [oobCode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state.status !== "form" || !oobCode) return;
    if (mismatch) return setError("Passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      await authService.resetPassword(oobCode, password);
      setState({ status: "done" });
      // Sign straight in with the new password; the login page then opens the right home screen.
      await authService.signInWithEmail(state.email, password, true).catch(() => undefined);
      router.replace("/login");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f9ff", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 460, borderRadius: 6, boxShadow: "0 24px 60px rgba(29,110,242,0.10)" }}>
        <Box component={Link} href="/" sx={{ display: "inline-block", mb: 4, textDecoration: "none" }}>
          <Brand onLight />
        </Box>

        {state.status === "checking" && (
          <Stack spacing={2} sx={{ alignItems: "center", py: 3 }}>
            <CircularProgress />
            <Typography color="text.secondary">Chine-check ang reset link...</Typography>
          </Stack>
        )}

        {state.status === "form" && (
          <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
            <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: "#e3ecfd", color: "primary.main" }}>
                <LockResetOutlined fontSize="large" />
              </Avatar>
              <Typography variant="h5">Gumawa ng bagong password</Typography>
              <Typography color="text.secondary">
                Para sa <strong>{state.email}</strong>
              </Typography>
            </Stack>
            <PasswordField label="New Password" value={password} onChange={setPassword} autoComplete="new-password" />
            <Box>
              <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              <Typography variant="caption" color={mismatch ? "error" : "text.secondary"}>
                {mismatch ? "Passwords do not match." : `At least ${MIN_PASSWORD_LENGTH} characters.`}
              </Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy || password.length < MIN_PASSWORD_LENGTH || mismatch || !confirm}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ borderRadius: 99, py: 1.4, fontSize: 16 }}
            >
              {busy ? "Saving..." : "Save New Password"}
            </Button>
          </Stack>
        )}

        {state.status === "done" && (
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "#dcfce7", color: "#16a34a" }}>
              <CheckCircleOutline fontSize="large" />
            </Avatar>
            <Typography variant="h5">Napalitan na ang password mo!</Typography>
            <Typography color="text.secondary">Papasok ka na sa iyong account...</Typography>
            <CircularProgress size={24} />
          </Stack>
        )}

        {state.status === "error" && (
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "#fee2e2", color: "#dc2626" }}>
              <ErrorOutline fontSize="large" />
            </Avatar>
            <Typography variant="h5">Hindi magamit ang link</Typography>
            <Typography color="text.secondary">{state.message}</Typography>
            <Button component={Link} href="/login" variant="contained" sx={{ borderRadius: 99, px: 5 }}>
              Bumalik sa Login
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  );
}
