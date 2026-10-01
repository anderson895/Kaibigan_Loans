"use client";
import ArrowForward from "@mui/icons-material/ArrowForward";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import ChatOutlined from "@mui/icons-material/ChatOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlined from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import Login from "@mui/icons-material/Login";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneIphoneOutlined from "@mui/icons-material/PhoneIphoneOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { Avatar, Box, Button, Container, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Dancing_Script } from "next/font/google";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IMAGES } from "@/lib/assets";
import { Brand } from "./AppShell";
import { useAuth } from "./AuthProvider";
import { homeFor } from "./RoleGuard";

const script = Dancing_Script({ subsets: ["latin"], weight: ["500"] });

const NAV = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "how-it-works", label: "How It Works" },
  { id: "features", label: "Features" },
  { id: "contact", label: "Contact" },
];

const FEATURES = [
  { icon: <ShieldOutlined />, title: "Secure & Trusted", text: "Ligtas ang iyong impormasyon at transaksyon." },
  { icon: <BoltOutlined />, title: "Madaling Gamitin", text: "Simple at mabilis na proseso, walang komplikasyon." },
  {
    icon: <GroupsOutlined />,
    title: "Transparent Record",
    text: "Tingnan ang iyong current balance, loan history at payment details sa real-time.",
  },
  { icon: <PhoneIphoneOutlined />, title: "Accessible Anywhere", text: "Gamitin sa anumang device, 24/7." },
];

const STEPS = [
  { icon: <Login />, title: "Mag-sign in", text: "Gumawa ng account gamit ang email, o mag-sign in gamit ang Google." },
  { icon: <ReceiptLongOutlined />, title: "Mag-request ng Loan", text: "Ilagay kung magkano, kailan babayaran, at saan ipapadala ang pera." },
  { icon: <CloudUploadOutlined />, title: "Mag-upload ng Payment", text: "I-upload ang screenshot ng GCash o bank receipt. Babasahin ito ng system." },
  { icon: <HowToRegOutlined />, title: "Tingnan ang Balance", text: "Kapag na-approve, automatic na mababawas sa iyong balance." },
];

/** Icon in a soft blue rounded square, as in the reference design. */
function IconTile({ children, size = 56 }: { children: ReactNode; size?: number }) {
  return (
    <Avatar
      variant="rounded"
      sx={{ width: size, height: size, borderRadius: 3, bgcolor: "#e8f0fe", color: "primary.main", "& svg": { fontSize: size * 0.5 } }}
    >
      {children}
    </Avatar>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{ textAlign: "center", mb: 5 }}>
      <Typography variant="h4" sx={{ fontSize: { xs: 26, md: 32 } }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

function Header() {
  const { user, role, loading } = useAuth();
  const [active, setActive] = useState("home");

  // Highlight the nav item for the section currently on screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const signedIn = !loading && !!user;
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        bgcolor: "rgba(246, 249, 255, 0.85)",
        backdropFilter: "blur(10px)",
      }}
    >
      <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", py: 2, gap: 2 }}>
        <Box component="a" href="#home" sx={{ textDecoration: "none" }}>
          <Brand onLight />
        </Box>
        <Stack direction="row" spacing={5} sx={{ mx: "auto", display: { xs: "none", md: "flex" } }}>
          {NAV.map((item) => (
            <MuiLink
              key={item.id}
              href={`#${item.id}`}
              underline="none"
              sx={{
                color: active === item.id ? "primary.main" : "text.primary",
                fontWeight: 500,
                pb: 0.75,
                borderBottom: 2,
                borderColor: active === item.id ? "primary.main" : "transparent",
              }}
            >
              {item.label}
            </MuiLink>
          ))}
        </Stack>
        <Button
          component={Link}
          href={signedIn ? homeFor(role) : "/login"}
          variant="contained"
          startIcon={<PersonOutlined />}
          sx={{ ml: { xs: "auto", md: 0 }, px: 3, py: 1.1, borderRadius: 2.5 }}
        >
          {signedIn ? "Dashboard" : "Login"}
        </Button>
      </Container>
    </Box>
  );
}

function Hero() {
  return (
    <Container id="home" maxWidth="lg" sx={{ pt: { xs: 4, md: 7 }, pb: { xs: 6, md: 9 }, scrollMarginTop: 90 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.1fr) minmax(0, 1fr)" }, gap: { xs: 5, md: 4 }, alignItems: "center" }}>
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: "inline-flex", alignItems: "center", maxWidth: "100%", bgcolor: "#e3ecfd", color: "primary.main", px: 2, py: 0.75, borderRadius: 99, mb: 3 }}
          >
            <HandshakeOutlined fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Mas Madaling Magpautang, Mas Transparent na Process
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 36, sm: 48, md: 54, lg: 58 }, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            Tiwala. Kaibigan.
            <Box component="span" sx={{ display: "block", color: "primary.main", whiteSpace: { md: "nowrap" } }}>
              Mas Madaling Utang.
            </Box>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 3, maxWidth: 500, fontSize: 17, lineHeight: 1.7 }}>
            Ang Kaibigan Loans ay isang simple at secure na platform kung saan maaari kang magpautang, magbayad, at
            subaybayan ang iyong utang — lahat sa iisang lugar.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
            <Button
              component={Link}
              href="/login"
              variant="contained"
              size="large"
              startIcon={<PersonOutlined />}
              endIcon={<ArrowForward />}
              sx={{ borderRadius: 99, px: 5, py: 1.5, fontSize: 16 }}
            >
              Mag Login
            </Button>
            <Button
              component={Link}
              href="/login?mode=signup"
              variant="outlined"
              size="large"
              startIcon={<HowToRegOutlined />}
              sx={{ borderRadius: 99, px: 5, py: 1.5, fontSize: 16, borderWidth: 1.5, bgcolor: "background.paper" }}
            >
              Mag Sign Up
            </Button>
          </Stack>
        </Box>

        <Box sx={{ position: "relative" }}>
          {/* Soft blob behind the illustration */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: "-6% 4% 6% 14%",
              borderRadius: "46% 54% 42% 58% / 52% 44% 56% 48%",
              background: "radial-gradient(circle at 40% 40%, #dfe9fd, #eef4ff 70%)",
              zIndex: 0,
            }}
          />
          <Box
            component="img"
            src={IMAGES.heroDashboard.src}
            alt="Kaibigan Loans dashboard sa laptop at phone"
            width={IMAGES.heroDashboard.width}
            height={IMAGES.heroDashboard.height}
            sx={{ position: "relative", zIndex: 1, width: "100%", height: "auto", display: "block" }}
          />
        </Box>
      </Box>
    </Container>
  );
}

function Features() {
  return (
    <Box id="features" sx={{ bgcolor: "#fbfcff", py: { xs: 7, md: 9 }, scrollMarginTop: 70 }}>
      <Container maxWidth="lg">
        <SectionTitle title="Why Choose Kaibigan Loans?" subtitle="Sakto lang para sa mga kaibigan, simple, ligtas at maaasahan." />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 4 }}>
          {FEATURES.map((f) => (
            <Stack key={f.title} spacing={1.5} sx={{ alignItems: "center", textAlign: "center", px: 2 }}>
              <IconTile>{f.icon}</IconTile>
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{f.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 230, lineHeight: 1.7 }}>
                {f.text}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

function HowItWorks() {
  return (
    <Container id="how-it-works" maxWidth="lg" sx={{ py: { xs: 7, md: 9 }, scrollMarginTop: 70 }}>
      <SectionTitle title="How It Works" subtitle="Apat na simpleng hakbang — mula request hanggang bayad." />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 3 }}>
        {STEPS.map((step, i) => (
          <Box key={step.title} sx={{ bgcolor: "background.paper", border: "1px solid #e5e9f2", borderRadius: 4, p: 3 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <IconTile size={48}>{step.icon}</IconTile>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: "#dbe6fb" }}>{i + 1}</Typography>
            </Stack>
            <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{step.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {step.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}

function About() {
  return (
    <Box id="about" sx={{ bgcolor: "#fbfcff", py: { xs: 7, md: 9 }, scrollMarginTop: 70 }}>
      <Container maxWidth="md" sx={{ textAlign: "center" }}>
        <SectionTitle title="About Kaibigan Loans" subtitle="Para sa magkakaibigang nagtutulungan." />
        <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.8 }}>
          Ginawa ang Kaibigan Loans para hindi na kailangang ilista sa notebook o Word ang bawat utang. Makikita ng
          nagpapautang at ng umuutang ang parehong record — loan amount, interest, balance at due date — kaya walang
          kalituhan at mas buo ang tiwala sa isa&apos;t isa.
        </Typography>
      </Container>
    </Box>
  );
}

function Contact() {
  return (
    <Container id="contact" maxWidth="md" sx={{ py: { xs: 7, md: 9 }, textAlign: "center", scrollMarginTop: 70 }}>
      <SectionTitle title="Contact" subtitle="May tanong o gustong mag-loan?" />
      <Stack spacing={2.5} sx={{ alignItems: "center" }}>
        <IconTile>
          <ChatOutlined />
        </IconTile>
        <Typography color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.7 }}>
          I-message lang ang admin sa Messenger, o mag-login at gamitin ang <strong>Request Loan</strong>. Ibigay ang iyong
          email sa admin para ma-link ang iyong account.
        </Typography>
        <Button component={Link} href="/login" variant="contained" endIcon={<ArrowForward />} sx={{ borderRadius: 99, px: 4 }}>
          Mag Login
        </Button>
      </Stack>
    </Container>
  );
}

function Footer() {
  return (
    <Box component="footer" sx={{ position: "relative", pt: 6, pb: 8, overflow: "hidden" }}>
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        sx={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: { xs: 110, md: 170 } }}
      >
        <path d="M0,90 C240,10 420,10 720,80 C1000,150 1200,40 1440,20 L1440,200 L0,200 Z" fill="#dce8fd" />
        <path d="M0,140 C300,70 520,100 760,130 C1040,165 1240,90 1440,80 L1440,200 L0,200 Z" fill="#a9c6f8" />
      </Box>
      <Stack direction="row" spacing={3} sx={{ position: "relative", alignItems: "center", justifyContent: "center", px: 2 }}>
        <Box sx={{ width: { xs: 40, sm: 70 }, height: "1px", bgcolor: "primary.main", opacity: 0.4 }} />
        <Typography sx={{ fontFamily: script.style.fontFamily, color: "primary.dark", fontSize: { xs: 24, md: 30 }, textAlign: "center" }}>
          Magkakaisa sa bawat pangarap.
        </Typography>
        <Box sx={{ width: { xs: 40, sm: 70 }, height: "1px", bgcolor: "primary.main", opacity: 0.4 }} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ position: "relative", display: "block", textAlign: "center", mt: 2 }}>
        © {new Date().getFullYear()} Kaibigan Loans
      </Typography>
    </Box>
  );
}

export function LandingPage() {
  return (
    <Box sx={{ bgcolor: "#f6f9ff", minHeight: "100vh", overflowX: "clip", "html:has(&)": { scrollBehavior: "smooth" } }}>
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <About />
        <Contact />
      </main>
      <Footer />
    </Box>
  );
}
