/** Server-only: the branded "Kaibigan Loans" email layout shared by verification and password reset. */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface BrandedEmail {
  heading: string;
  /** Plain text paragraph (escaped for HTML). */
  intro: string;
  buttonLabel: string;
  link: string;
  /** Plain text shown under the button, e.g. "If you didn't ask for this, ignore this email." */
  footer: string;
}

export function renderBrandedEmail({ heading, intro, buttonLabel, link, footer }: BrandedEmail): { html: string; text: string } {
  const safeLink = escapeHtml(link);
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f1f3d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#1d6ef2">Kaibigan Loans</td></tr>
<tr><td style="font-size:13px;color:#64748b;padding-bottom:24px">Tulong sa mga Kaibigan</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px">${escapeHtml(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px">${escapeHtml(intro)}</td></tr>
<tr><td align="center" style="padding-bottom:24px"><a href="${safeLink}" style="display:inline-block;background:#1d6ef2;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:999px">${escapeHtml(buttonLabel)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#64748b">Kung hindi gumana ang button, i-copy ang link na ito:<br><a href="${safeLink}" style="color:#1d6ef2;word-break:break-all">${safeLink}</a><br><br>${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${buttonLabel}: ${link}\n\n${footer}`;
  return { html, text };
}
