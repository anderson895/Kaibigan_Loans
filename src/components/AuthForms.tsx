"use client";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import Google from "@mui/icons-material/Google";
import LockOutlined from "@mui/icons-material/LockOutlined";
import MarkEmailReadOutlined from "@mui/icons-material/MarkEmailReadOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent, type ReactNode } from "react";
import { authErrorMessage, MIN_PASSWORD_LENGTH } from "@/services/AuthService";
import { authService } from "@/services/container";
import { useAuth } from "./AuthProvider";

/** Runs an async action with a busy flag and a friendly error message. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, notice, run, setError };
}

const pill = { borderRadius: 99, py: 1.4, fontSize: 16 };

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 800, lineHeight: 1.2 }}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, fontSize: 17 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

function Field({ label, icon, ...props }: { label: string; icon: ReactNode } & React.ComponentProps<typeof TextField>) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 600, mb: 0.75 }}>{label}</Typography>
      <TextField
        fullWidth
        {...props}
        slotProps={{
          ...props.slotProps,
          input: {
            startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
            ...(props.slotProps?.input as object),
            sx: { borderRadius: 1.2, bgcolor: "background.paper" },
          },
        }}
      />
    </Box>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      icon={<LockOutlined color="action" />}
      type={show ? "text" : "password"}
      placeholder="Ilagay ang iyong password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShow(!show)} edge="end" aria-label={show ? "Itago ang password" : "Ipakita ang password"}>
                {show ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

function GoogleButton({ label, busy, onError }: { label: string; busy: boolean; onError: (msg: string) => void }) {
  return (
    <Button
      variant="outlined"
      size="large"
      startIcon={<Google />}
      disabled={busy}
      sx={{ ...pill, borderWidth: 1.5 }}
      onClick={() => authService.signInWithGoogle().catch((e) => onError(authErrorMessage(e)))}
    >
      {label}
    </Button>
  );
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
    </>
  );
}

export function LoginForm({ onSignup, onForgot }: { onSignup: () => void; onForgot: (email: string) => void }) {
  const { busy, error, notice, run, setError } = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => authService.signInWithEmail(email, password, remember));
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
      <Heading title="Welcome Back!" subtitle="Mag-log in para i-access ang iyong account." />
      <Field
        label="Email"
        icon={<EmailOutlined color="action" />}
        type="email"
        placeholder="Ilagay ang iyong email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label="Remember me" />
        <MuiLink component="button" type="button" onClick={() => onForgot(email)} underline="hover" sx={{ fontWeight: 500 }}>
          Forgot password?
        </MuiLink>
      </Stack>
      <Messages error={error} notice={notice} />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={busy || !email || !password}
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PersonOutlined />}
        sx={pill}
      >
        Mag-Login
      </Button>
      <Divider sx={{ color: "text.secondary", fontSize: 14 }}>o</Divider>
      <GoogleButton label="Sign in with Google" busy={busy} onError={setError} />
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Wala pang account?{" "}
        <MuiLink component="button" type="button" onClick={onSignup} sx={{ fontWeight: 600, verticalAlign: "baseline" }}>
          Mag Sign Up
        </MuiLink>
      </Typography>
    </Stack>
  );
}

export function SignupForm({ onLogin }: { onLogin: () => void }) {
  const { busy, error, notice, run, setError } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return setError("Hindi magkapareho ang password.");
    run(() => authService.register(name, email, password));
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
      <Heading title="Gumawa ng Account" subtitle="Libre at mabilis. I-verify lang ang iyong email pagkatapos." />
      <Field
        label="Buong Pangalan"
        icon={<PersonOutlined color="action" />}
        placeholder="hal. Juan Dela Cruz"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
      />
      <Field
        label="Email"
        icon={<EmailOutlined color="action" />}
        type="email"
        placeholder="Ilagay ang iyong email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        helperText="Ito ang email na ibibigay mo sa nagpautang para ma-link ang iyong loan."
        required
      />
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
      <Box>
        <PasswordField label="Ulitin ang Password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <Typography variant="caption" color={mismatch ? "error" : "text.secondary"}>
          {mismatch ? "Hindi magkapareho ang password." : `Dapat ${MIN_PASSWORD_LENGTH} characters pataas.`}
        </Typography>
      </Box>
      <Messages error={error} notice={notice} />
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={busy || !name || !email || password.length < MIN_PASSWORD_LENGTH || mismatch || !confirm}
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PersonOutlined />}
        sx={pill}
      >
        Mag Sign Up
      </Button>
      <Divider sx={{ color: "text.secondary", fontSize: 14 }}>o</Divider>
      <GoogleButton label="Sign up with Google" busy={busy} onError={setError} />
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        May account na?{" "}
        <MuiLink component="button" type="button" onClick={onLogin} sx={{ fontWeight: 600, verticalAlign: "baseline" }}>
          Mag-Login
        </MuiLink>
      </Typography>
    </Stack>
  );
}

export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { busy, error, notice, run } = useAction();
  const [email, setEmail] = useState(initialEmail);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => authService.sendPasswordReset(email),
      "Kung may account ang email na ito, may ipinadala kaming link para mag-reset ng password. I-check ang inbox (at Spam).",
    );
  };

  return (
    <Stack component="form" spacing={2.5} onSubmit={submit} noValidate>
      <Heading title="Forgot Password" subtitle="Ilagay ang iyong email at padadalhan ka namin ng reset link." />
      <Field
        label="Email"
        icon={<EmailOutlined color="action" />}
        type="email"
        placeholder="Ilagay ang iyong email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Messages error={error} notice={notice} />
      <Button type="submit" variant="contained" size="large" disabled={busy || !email} sx={pill}>
        {busy ? "Sending..." : "I-send ang Reset Link"}
      </Button>
      <Button onClick={onBack}>Bumalik sa Login</Button>
    </Stack>
  );
}

/** Shown after sign-up (or to any unverified email account) until the email link is clicked. */
export function VerifyEmailPanel() {
  const { user, reloadUser } = useAuth();
  const { busy, error, notice, run, setError } = useAction();

  return (
    <Stack spacing={2.5} sx={{ textAlign: "center", alignItems: "center" }}>
      <Avatar sx={{ width: 64, height: 64, bgcolor: "#e3ecfd", color: "primary.main" }}>
        <MarkEmailReadOutlined fontSize="large" />
      </Avatar>
      <Heading title="I-verify ang Email" subtitle="Isang hakbang na lang!" />
      <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
        Nagpadala kami ng verification link sa <strong>{user?.email}</strong>. Buksan ang email at i-click ang link, tapos
        bumalik dito at i-click ang <strong>Na-verify ko na</strong>.
      </Typography>
      <Box sx={{ width: "100%" }}>
        <Messages error={error} notice={notice} />
      </Box>
      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={busy}
        sx={pill}
        onClick={() =>
          run(async () => {
            if (!(await reloadUser())) setError("Hindi pa verified. I-click muna ang link sa email (i-check din ang Spam).");
          })
        }
      >
        Na-verify ko na
      </Button>
      <Button fullWidth variant="outlined" disabled={busy} sx={{ ...pill, borderWidth: 1.5 }} onClick={() => run(() => authService.resendVerification(), "Naipadala ulit ang verification email.")}>
        I-send ulit ang link
      </Button>
      <Button onClick={() => authService.signOut()}>Gumamit ng ibang account</Button>
    </Stack>
  );
}
