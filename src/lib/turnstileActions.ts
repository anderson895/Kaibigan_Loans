/**
 * Cloudflare Turnstile action per form. The widget stamps it into the token, and the server only accepts
 * tokens whose action belongs to the endpoint, so a token solved on one form can't be used on another.
 */
export const TURNSTILE_ACTIONS = {
  login: "login",
  signup: "signup",
  resendVerification: "resend_verification",
  forgotPassword: "forgot_password",
} as const;
