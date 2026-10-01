"use client";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { useState } from "react";
import type { Borrower, BorrowerInput } from "@/domain/Borrower";
import { useCreateBorrower, useUpdateBorrower } from "@/hooks/queries";
import { ErrorAlert } from "./ui";

const empty: BorrowerInput = { name: "", email: "", phone: "", payoutDetails: "" };

/** Create (borrower = null) or edit a contact. Pass a new `key` to reset the form. */
export function BorrowerDialog({ open, borrower, onClose }: { open: boolean; borrower: Borrower | null; onClose: () => void }) {
  const create = useCreateBorrower();
  const update = useUpdateBorrower();
  const [values, setValues] = useState<BorrowerInput>(borrower ? { ...borrower.toProps() } : empty);
  const mutation = borrower ? update : create;
  const set = (key: keyof BorrowerInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [key]: e.target.value });

  const save = () => {
    const done = { onSuccess: onClose };
    if (borrower) update.mutate({ borrower, changes: values }, done);
    else create.mutate(values, done);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{borrower ? "Edit Contact" : "New Contact"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Pangalan" required value={values.name} onChange={set("name")} />
          <TextField
            label="Email na gamit sa pag-login"
            required
            type="email"
            value={values.email}
            onChange={set("email")}
            helperText="Gmail (kung Google sign-in) o ang email na ni-register niya"
          />
          <TextField label="Phone / Messenger" value={values.phone} onChange={set("phone")} />
          <TextField
            label="Saan ipapadala ang pera"
            placeholder="GCash 0917 123 4567 — Juan D."
            multiline
            minRows={2}
            value={values.payoutDetails}
            onChange={set("payoutDetails")}
          />
          <ErrorAlert error={mutation.error} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={mutation.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
