"use client";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import { Button, IconButton, List, ListItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorAlert, Loading, PageHeader } from "@/components/ui";
import { useAdminMutations, useAdmins } from "@/hooks/queries";

export default function SettingsPage() {
  const { email: me } = useAuth();
  const admins = useAdmins();
  const { add, remove } = useAdminMutations();
  const [email, setEmail] = useState("");

  return (
    <>
      <PageHeader title="Settings" subtitle="Who can manage loans." />
      <Paper sx={{ p: 2.5, maxWidth: 560 }}>
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
    </>
  );
}
