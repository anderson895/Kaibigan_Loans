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
      <Typography variant="h5">Hindi pa naka-link ang account mo</Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
        Para makita mo ang iyong loan at makapag-upload ng payment, kailangan ka munang i-add ng nagpautang sa kanyang
        Contacts gamit ang email na ito:
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 2.5, alignItems: "center", justifyContent: "center", bgcolor: "#f1f5fb", borderRadius: 2, p: 1.5 }}
      >
        <Typography sx={{ fontWeight: 700, wordBreak: "break-all" }}>{email}</Typography>
        <Button size="small" variant="outlined" startIcon={<ContentCopy />} onClick={copy} sx={{ flexShrink: 0 }}>
          {copied ? "Na-copy!" : "Copy"}
        </Button>
      </Stack>
      <Box component="ol" sx={{ textAlign: "left", color: "text.secondary", mt: 3, mb: 0, pl: 3, lineHeight: 1.9 }}>
        <li>I-copy ang email sa itaas at i-send sa nagpautang (hal. sa Messenger).</li>
        <li>Hintayin na ma-add ka niya sa Contacts.</li>
        <li>I-refresh ang page na ito — lalabas na ang iyong mga loan.</li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Maling account? Gamitin ang <strong>Mag Logout</strong> sa sidebar at mag-login ulit.
      </Typography>
    </Paper>
  );
}
