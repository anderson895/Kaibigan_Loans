"use client";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Bolt from "@mui/icons-material/Bolt";
import Google from "@mui/icons-material/Google";
import Groups from "@mui/icons-material/Groups";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import { Alert, Avatar, Box, Button, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import { Caveat_Brush } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Brand } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { homeFor } from "@/components/RoleGuard";
import { authService } from "@/services/container";

const brush = Caveat_Brush({ subsets: ["latin"], weight: "400" });

const PERKS: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Bolt />, title: "Mabilis na Proseso", text: "Walang matagal na pila o komplikadong requirements." },
  { icon: <VerifiedUser />, title: "Ligtas at Secure", text: "Ang iyong impormasyon ay protektado namin." },
  { icon: <Groups />, title: "Para sa mga Kaibigan", text: "Tulong mula sa komunidad, para sa mas magandang bukas." },
];

/** Left marketing panel: headline, perks, coin illustration and the brush-script slogan. */
function Showcase() {
  return (
    <Box sx={{ position: "relative", display: { xs: "none", md: "block" }, pl: { md: 2, lg: 6 } }}>
      <Box component={Link} href="/" sx={{ display: "inline-block", textDecoration: "none", mb: 5 }}>
        <Brand onLight />
      </Box>
      <Typography component="h1" sx={{ fontSize: { md: 38, lg: 44 }, fontWeight: 800, lineHeight: 1.12, maxWidth: 460 }}>
        Mas Madaling Kumuhang Loan, Mas{" "}
        <Box component="span" sx={{ color: "primary.main" }}>
          Maliwanag na Bukas.
        </Box>
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2, fontSize: 17, maxWidth: 380, lineHeight: 1.5 }}>
        Mabilis, ligtas at maaasahang loan services para sa mga Pilipinong tulad mo.
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "center", mt: 4, gap: 2 }}>
        <Stack spacing={3}>
          {PERKS.map((p) => (
            <Stack key={p.title} direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
              <Avatar sx={{ width: 52, height: 52, bgcolor: "#e3ecfd", color: "primary.main", flexShrink: 0 }}>{p.icon}</Avatar>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{p.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {p.text}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
        <Box
          component="img"
          src="/login-coins.webp"
          alt="Phone na may check mark at mga piso coins"
          width={321}
          height={323}
          sx={{
            width: "100%",
            maxWidth: 340,
            height: "auto",
            justifySelf: "center",
            mixBlendMode: "multiply",
            // The source image has an opaque light background; fade its edges into the page.
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 52%, #000 72%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 52%, #000 72%, transparent 100%)",
          }}
        />
      </Box>

      <Box sx={{ mt: 4, ml: 1, display: "inline-block", transform: "rotate(-8deg)", color: "primary.main" }}>
        <Typography sx={{ fontFamily: brush.style.fontFamily, fontSize: 34, lineHeight: 1.05 }}>
          Kaibigan Tayo,
          <br />
          &nbsp;&nbsp;Kaya Natin Ito!
        </Typography>
        <Box component="svg" viewBox="0 0 200 24" sx={{ width: 170, height: 20, display: "block", mt: 0.5 }} aria-hidden>
          <path d="M4 18 C60 6 130 2 196 6" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
        </Box>
      </Box>
    </Box>
  );
}

function LoginView() {
  const { user, role, loading, refreshRole } = useAuth();
  const router = useRouter();
  const signup = useSearchParams().get("mode") === "signup";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") return router.replace(homeFor(role));
    // A signed-in non-admin: offer first-time admin setup if nobody has claimed it yet.
    authService
      .isSetupDone()
      .then((done) => (done ? router.replace(homeFor(role)) : setNeedsSetup(true)))
      .catch((e) =>
        setError(`Hindi ma-check ang admin setup (${e instanceof Error ? e.message : e}). Naka-deploy na ba ang Firestore rules?`),
      );
  }, [loading, user, role, router]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const card = needsSetup && user ? (
    <Stack spacing={2}>
      <Typography variant="h5">First-time setup</Typography>
      <Typography color="text.secondary">
        Wala pang admin. Gawing admin ang <strong>{user.email}</strong>? Isang beses lang ito pwedeng gawin.
      </Typography>
      <Button
        variant="contained"
        size="large"
        disabled={busy}
        sx={{ borderRadius: 99, py: 1.4 }}
        onClick={() =>
          run(async () => {
            await authService.claimFirstAdmin(user);
            await refreshRole();
            router.replace("/dashboard");
          })
        }
      >
        Oo, gawin akong admin
      </Button>
      <Button variant="outlined" sx={{ borderRadius: 99, py: 1.2 }} onClick={() => router.replace(homeFor(role))}>
        Hindi, borrower ako
      </Button>
    </Stack>
  ) : (
    <Stack spacing={3}>
      <Box>
        <Typography sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 800, lineHeight: 1.2 }}>
          {signup ? "Gumawa ng Account" : "Welcome Back!"}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, fontSize: 17 }}>
          {signup ? "Ang Google account mo na ang magiging account mo dito." : "Mag-log in para i-access ang iyong account."}
        </Typography>
      </Box>
      <Button
        variant="contained"
        size="large"
        startIcon={busy || loading ? <CircularProgress size={18} color="inherit" /> : <Google />}
        disabled={busy || loading}
        onClick={() => run(() => authService.signInWithGoogle())}
        sx={{ borderRadius: 99, py: 1.6, fontSize: 17 }}
      >
        {signup ? "Sign up with Google" : "Sign in with Google"}
      </Button>
      <Divider sx={{ color: "text.secondary", fontSize: 14 }}>o</Divider>
      <Button component={Link} href="/" variant="outlined" size="large" startIcon={<ArrowBack />} sx={{ borderRadius: 99, py: 1.4, borderWidth: 1.5 }}>
        Bumalik sa Home
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        {signup ? "May account na? " : "Wala pang account? "}
        <Box component={Link} href={signup ? "/login" : "/login?mode=signup"} sx={{ color: "primary.main", fontWeight: 600 }}>
          {signup ? "Mag Login" : "Mag Sign Up"}
        </Box>
      </Typography>
    </Stack>
  );

  return (
    <Box sx={{ position: "relative", minHeight: "100vh", bgcolor: "#f6f9ff", overflow: "hidden" }}>
      {/* Decorative waves: bottom-left and top-right corners */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: -180,
          bottom: -220,
          width: 560,
          height: 520,
          borderRadius: "50%",
          background: "linear-gradient(160deg, #dbe7fd, #bcd3fb)",
          opacity: 0.8,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: -140,
          top: -200,
          width: 460,
          height: 420,
          borderRadius: "50%",
          background: "linear-gradient(200deg, #c9dbfc, #e4edfe)",
          opacity: 0.9,
        }}
      />

      <Box
        sx={{
          position: "relative",
          maxWidth: 1360,
          mx: "auto",
          minHeight: "100vh",
          px: { xs: 2, sm: 4 },
          py: { xs: 4, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.05fr) minmax(0, 0.95fr)" },
          gap: { xs: 3, md: 6 },
          alignItems: "center",
        }}
      >
        <Showcase />
        <Paper
          sx={{
            p: { xs: 3, sm: 5 },
            width: "100%",
            maxWidth: 560,
            justifySelf: "center",
            borderRadius: 6,
            border: "1px solid #e8eef8",
            boxShadow: "0 24px 60px rgba(29,110,242,0.10)",
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Brand onLight />
          </Box>
          {card}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
