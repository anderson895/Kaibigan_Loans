"use client";
import ContentCopy from "@mui/icons-material/ContentCopy";
import LinkOff from "@mui/icons-material/LinkOff";
import { Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

/** Shown to a signed-in user whose Gmail is not yet in the lender's Contacts. */
export function NotLinkedCard() {
  const { email } = useAuth();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the email is still visible to copy by hand.
    }
  };

  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 560, mx: "auto", mt: { xs: 2, md: 6 }, textAlign: "center", borderRadius: 4 }}>
      <Avatar sx={{ width: 64, height: 64, mx: "auto", mb: 2, bgcolor: "#fef3c7", color: "#b45309" }}>
        <LinkOff fontSize="large" />
      </Avatar>
      <Typography variant="h5">Setting up your borrower profile</Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
        We could not load your borrower profile yet. Refresh the page in a moment. If it still shows, send this email to
        your lender:
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 2.5, alignItems: "center", justifyContent: "center", bgcolor: "#f1f5fb", borderRadius: 2, p: 1.5 }}
      >
        <Typography sx={{ fontWeight: 700, wordBreak: "break-all" }}>{email}</Typography>
        <Button size="small" variant="outlined" startIcon={<ContentCopy />} onClick={copy} sx={{ flexShrink: 0 }}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </Stack>
      <Box component="ol" sx={{ textAlign: "left", color: "text.secondary", mt: 3, mb: 0, pl: 3, lineHeight: 1.9 }}>
        <li>Refresh this page.</li>
        <li>If this keeps showing, copy the email above and send it to your lender.</li>
        <li>Your loans will appear here once your profile is ready.</li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Wrong account? Use <strong>Logout</strong> in the sidebar and sign in again.
      </Typography>
    </Paper>
  );
}
