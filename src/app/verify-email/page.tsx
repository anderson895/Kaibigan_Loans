"use client";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import MarkEmailReadOutlined from "@mui/icons-material/MarkEmailReadOutlined";
import { Avatar, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { homeFor } from "@/components/RoleGuard";
import { authErrorMessage } from "@/services/AuthService";
import { authService } from "@/services/container";

type State = { status: "working" } | { status: "done" } | { status: "error"; message: string };

/** Landing page for the link in our verification email (sent with Nodemailer + Gmail). */
function VerifyEmailView() {
  const oobCode = useSearchParams().get("oobCode");
  const { user, role, loading, reloadUser } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    // Wait for auth to settle so the signed-in user is refreshed after verifying. Codes are single-use.
    if (loading || started.current) return;
    started.current = true;
    if (!oobCode) return setState({ status: "error", message: "Missing verification code. Open the link from your email again." });
    authService
      .verifyEmail(oobCode)
      .then(async () => {
        // Same browser as sign-up: refresh the session so the app opens straight away.
        if (user) await reloadUser().catch(() => undefined);
        setState({ status: "done" });
      })
      .catch((e) => setState({ status: "error", message: authErrorMessage(e) }));
  }, [loading, oobCode, user, reloadUser]);

  // Signed in on this device: skip the success screen and enter the app.
  useEffect(() => {
    if (state.status === "done" && user && role) {
      const t = window.setTimeout(() => router.replace(homeFor(role)), 1200);
      return () => window.clearTimeout(t);
    }
  }, [state.status, user, role, router]);

  const next = user ? homeFor(role) : "/login";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f9ff", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 460, borderRadius: 6, textAlign: "center", boxShadow: "0 24px 60px rgba(29,110,242,0.10)" }}>
        <Box component={Link} href="/" sx={{ display: "inline-block", mb: 4, textDecoration: "none" }}>
          <Brand onLight />
        </Box>
        {state.status === "working" && (
          <Stack spacing={2} sx={{ alignItems: "center", py: 3 }}>
            <CircularProgress />
            <Typography color="text.secondary">Vine-verify ang iyong email...</Typography>
          </Stack>
        )}
        {state.status === "done" && (
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "#dcfce7", color: "#16a34a" }}>
              <MarkEmailReadOutlined fontSize="large" />
            </Avatar>
            <Typography variant="h5">Verified na ang email mo!</Typography>
            <Typography color="text.secondary">{user ? "Papasok ka na sa iyong account..." : "Mag-login na para makapasok sa iyong account."}</Typography>
            <Button component={Link} href={next} variant="contained" size="large" sx={{ borderRadius: 99, px: 5 }}>
              {user ? "Magpatuloy" : "Mag-Login"}
            </Button>
          </Stack>
        )}
        {state.status === "error" && (
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "#fee2e2", color: "#dc2626" }}>
              <ErrorOutline fontSize="large" />
            </Avatar>
            <Typography variant="h5">Hindi ma-verify</Typography>
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
