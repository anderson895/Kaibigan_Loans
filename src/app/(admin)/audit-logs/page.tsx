"use client";
import Search from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useMemo, useState } from "react";
import { ACTIVITY_GROUPS, activityMeta, type ActivityGroup } from "@/components/ActivityFeed";
import { cardsOnPhone, EmptyState, ErrorAlert, Loading, NameCell, PageHeader } from "@/components/ui";
import { formatPeso } from "@/domain/money";
import { useAdmins, useAuditLog, useBorrowers } from "@/hooks/queries";

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Every action by admins and borrowers: who did what, and when. Entries cannot be edited or deleted. */
export default function AuditLogsPage() {
  const log = useAuditLog();
  const { data: borrowers = [] } = useBorrowers();
  const { data: admins = [] } = useAdmins();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<ActivityGroup | "all">("all");

  // Entries store who did it by email; show the borrower's name when we know it.
  const names = useMemo(() => new Map(borrowers.filter((b) => b.hasEmail).map((b) => [b.email, b.name])), [borrowers]);
  const adminEmails = useMemo(() => new Set(admins), [admins]);
  const entries = useMemo(() => log.data?.pages.flat() ?? [], [log.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const meta = activityMeta(e.type);
      if (group !== "all" && meta.group !== group) return false;
      return !q || [e.actorEmail, names.get(e.actorEmail) ?? "", meta.label, e.message].some((s) => s.toLowerCase().includes(q));
    });
  }, [entries, group, search, names]);

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Every action by admins and borrowers: who did what, and when." />
      <Paper sx={{ p: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search by name, email or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
          />
          <TextField select size="small" value={group} onChange={(e) => setGroup(e.target.value as ActivityGroup | "all")} sx={{ minWidth: 200 }}>
            <MenuItem value="all">All actions</MenuItem>
            {ACTIVITY_GROUPS.map((g) => (
              <MenuItem key={g.value} value={g.value}>
                {g.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <ErrorAlert error={log.error} />
        {log.isPending ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState>
            {entries.length === 0 ? "No activity yet." : log.hasNextPage ? "No matches in the loaded entries." : "No matches."}
          </EmptyState>
        ) : (
          <TableContainer sx={cardsOnPhone}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>When</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((e) => {
                  const meta = activityMeta(e.type);
                  const name = names.get(e.actorEmail);
                  const role = adminEmails.has(e.actorEmail) ? "Admin" : name ? "Borrower" : "";
                  return (
                    <TableRow key={e.id}>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <NameCell name={name ?? (e.actorEmail || "Unknown")} sub={[role, name && e.actorEmail].filter(Boolean).join(" · ")} />
                      </TableCell>
                      <TableCell data-label="Action">
                        <Chip size="small" label={meta.label} sx={{ bgcolor: meta.bg, color: meta.fg }} />
                      </TableCell>
                      <TableCell data-label="When" sx={{ whiteSpace: { sm: "nowrap" } }}>
                        {formatWhen(e.createdAt)}
                      </TableCell>
                      <TableCell data-label="Details" data-wide>
                        {e.message}
                        {e.amount != null && <strong> {formatPeso(e.amount)}</strong>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {log.hasNextPage && (
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => log.fetchNextPage()}
              disabled={log.isFetchingNextPage}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {log.isFetchingNextPage ? "Loading..." : "Load older entries"}
            </Button>
          </Box>
        )}
      </Paper>
    </>
  );
}
