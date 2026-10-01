"use client";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import AddCircleOutline from "@mui/icons-material/AddCircleOutlineOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import VolunteerActivismOutlined from "@mui/icons-material/VolunteerActivismOutlined";
import {
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { usePayments } from "@/hooks/queries";
import { SIDEBAR_BG, SIDEBAR_WIDTH } from "@/lib/theme";
import { authService } from "@/services/container";
import { useAuth } from "./AuthProvider";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <DashboardOutlined /> },
  { href: "/loans", label: "Loans", icon: <ReceiptLongOutlined /> },
  { href: "/payments", label: "Payments", icon: <PaymentsOutlined /> },
  { href: "/borrowers", label: "Contacts", icon: <GroupOutlined /> },
  { href: "/reports", label: "Reports", icon: <AssessmentOutlined /> },
];

const BORROWER_NAV: NavItem[] = [
  { href: "/my-loans", label: "My Loans", icon: <ReceiptLongOutlined /> },
  { href: "/request", label: "Request Loan", icon: <AddCircleOutline /> },
];

/** Logo + name. `onLight` switches the text colors for light backgrounds (landing page). */
export function Brand({ onLight = false }: { onLight?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Avatar variant={onLight ? "rounded" : "circular"} sx={{ bgcolor: "#1d6ef2", width: 44, height: 44, borderRadius: onLight ? 2.5 : "50%" }}>
        <VolunteerActivismOutlined />
      </Avatar>
      <Box>
        <Typography sx={{ fontWeight: 700, color: onLight ? "text.primary" : "#fff", lineHeight: 1.2, fontSize: onLight ? 18 : 16 }}>
          Kaibigan Loans
        </Typography>
        <Typography variant="caption" sx={{ color: onLight ? "text.secondary" : "#94a3b8" }}>
          Tulong sa mga Kaibigan
        </Typography>
      </Box>
    </Stack>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <List sx={{ px: 1.5 }}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            onClick={onNavigate}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: active ? "#fff" : "#cbd5e1",
              bgcolor: active ? "primary.main" : "transparent",
              "&:hover": { bgcolor: active ? "primary.main" : "rgba(255,255,255,0.06)" },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 38 }}>{item.icon}</ListItemIcon>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
          </ListItemButton>
        );
      })}
    </List>
  );
}

function PendingBell() {
  const router = useRouter();
  const { data } = usePayments();
  const pending = data?.filter((p) => p.isPending).length ?? 0;
  return (
    <IconButton onClick={() => router.push("/payments")} aria-label="Pending payments">
      <Badge badgeContent={pending} color="error">
        <NotificationsOutlined />
      </Badge>
    </IconButton>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const isAdmin = role === "admin";
  const items = isAdmin ? ADMIN_NAV : BORROWER_NAV;

  const sidebar = (
    <Box sx={{ height: "100%", bgcolor: SIDEBAR_BG, display: "flex", flexDirection: "column", py: 2.5 }}>
      <Box sx={{ px: 2.5, mb: 3 }}>
        <Brand />
      </Box>
      <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
      <Box sx={{ flexGrow: 1 }} />
      {isAdmin && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mx: 2, mb: 1 }} />
          <NavLinks
            items={[{ href: "/settings", label: "Settings", icon: <SettingsOutlined /> }]}
            onNavigate={() => setMobileOpen(false)}
          />
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box component="nav" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH } }}
        >
          {sidebar}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH } }}
        >
          {sidebar}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar sx={{ gap: 1, px: { xs: 2, md: 4 } }}>
          <IconButton sx={{ display: { md: "none" } }} onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          {isAdmin && <PendingBell />}
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="Account">
            <Avatar src={user?.photoURL ?? undefined} sx={{ width: 34, height: 34 }} />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setMenuAnchor(null);
                await authService.signOut();
                router.replace("/login");
              }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
        <Box sx={{ px: { xs: 2, md: 4 }, pb: 5 }}>{children}</Box>
      </Box>
    </Box>
  );
}
