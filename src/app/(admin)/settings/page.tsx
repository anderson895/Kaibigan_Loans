"use client";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import OpenInNew from "@mui/icons-material/OpenInNew";
import { Alert, Button, IconButton, List, ListItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorAlert, Loading, PageHeader } from "@/components/ui";
import { useAdminMutations, useAdmins, useLenderContact, useSaveLenderContact } from "@/hooks/queries";

/** Pre-filled for convenience (from the lender's portfolio); only stored once Save is clicked. */
const SUGGESTED_FACEBOOK = "facebook.com/joshuapadilla895";

function ContactSettings() {
  const { email: me } = useAuth();
  const contact = useLenderContact();
  const save = useSaveLenderContact();
  const [messenger, setMessenger] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!contact.data) return;
    setMessenger(contact.data.messengerUrl || SUGGESTED_FACEBOOK);
    setEmail(contact.data.email || me);
    setPhone(contact.data.phone);
  }, [contact.data, me]);

  const unsaved = !!contact.data && !contact.data.email && !contact.data.messengerUrl;

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6">Contact</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Borrowers send their loan request to you through these. You still create the loan yourself in Borrowers → New Loan.
      </Typography>
      {unsaved && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Not saved yet — check the details below and click Save.
        </Alert>
      )}
      <Stack spacing={2}>
        <TextField
          size="small"
          label="Facebook username or profile link"
          placeholder="e.g. juan.delacruz or facebook.com/juan.delacruz"
          value={messenger}
          onChange={(e) => setMessenger(e.target.value)}
        />
        <TextField size="small" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField size="small" label="Contact number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
          <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate({ messenger, email, phone })}>
            Save
          </Button>
          {contact.data?.messengerUrl && (
            <Button size="small" href={contact.data.messengerUrl} target="_blank" rel="noopener" endIcon={<OpenInNew />}>
              Test Messenger
            </Button>
          )}
        </Stack>
      </Stack>
      {save.isSuccess && (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          Saved.
        </Alert>
      )}
      <ErrorAlert error={contact.error ?? save.error} />
    </Paper>
  );
}

export default function SettingsPage() {
  const { email: me } = useAuth();
  const admins = useAdmins();
  const { add, remove } = useAdminMutations();
  const [email, setEmail] = useState("");

  return (
    <>
      <PageHeader title="Settings" subtitle="Your contact details and who can manage loans." />
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <ContactSettings />
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Admins
          </Typography>
          {admins.isPending ? (
            <Loading />
          ) : (
            <List dense>
              {(admins.data ?? []).map((a) => (
                <ListItem
                  key={a}
                  secondaryAction={
                    a !== me && (
                      <IconButton edge="end" color="error" onClick={() => remove.mutate(a)} aria-label={`Remove ${a}`}>
                        <DeleteOutline />
                      </IconButton>
                    )
                  }
                >
                  <Typography variant="body2">
                    {a} {a === me && "(you)"}
                  </Typography>
                </ListItem>
              ))}
            </List>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" fullWidth placeholder="New admin's email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button variant="contained" disabled={!email || add.isPending} onClick={() => add.mutate(email, { onSuccess: () => setEmail("") })}>
              Add
            </Button>
          </Stack>
          <ErrorAlert error={admins.error ?? add.error ?? remove.error} />
        </Paper>
      </Stack>
    </>
  );
}
