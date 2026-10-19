import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import ViewKanbanOutlined from "@mui/icons-material/ViewKanbanOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Logout from "@mui/icons-material/Logout";
import {
  NavLink,
  Outlet,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSubmit,
} from "react-router";
import type { appLoader } from "../routes/loaders";
import { api, type UserNotification } from "../api/client";
import { can } from "../lib/permissions";
import { formatDateTime, initials } from "../lib/format";
import type { TPermissionArea } from "../types/users";
import logoUrl from "../assets/logo.svg";

const DRAWER_WIDTH = 232;

const NAV: { to: string; label: string; icon: React.ReactNode; area: TPermissionArea }[] = [
  { to: "/deals/dashboard", label: "Deals", icon: <ViewKanbanOutlined />, area: "deals_dashboard" },
  { to: "/team", label: "Team", icon: <GroupsOutlined />, area: "team_management" },
  { to: "/settings", label: "Settings", icon: <SettingsOutlined />, area: "settings" },
];

function NotificationsBell({ items, userId }: { items: UserNotification[]; userId: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const unread = items.filter((n) => !n.read).length;

  const open = async (n: UserNotification) => {
    await api.notifications.markRead(n.id, userId);
    setAnchor(null);
    navigate(`/deals/${n.dealId}?tab=diligence`);
    revalidator.revalidate();
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Notifications">
        <Badge badgeContent={unread} color="error">
          <NotificationsNone />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ width: 380, maxHeight: 460, overflowY: "auto" }}>
          <Stack
            sx={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              py: 1.25,
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>Notifications</Typography>
            <Button
              size="small"
              disabled={!unread}
              onClick={async () => {
                await api.notifications.markAllRead(userId);
                revalidator.revalidate();
              }}
            >
              Mark all read
            </Button>
          </Stack>
          <Divider />
          {items.length === 0 && (
            <Typography sx={{ p: 2, color: "text.secondary" }} variant="body2">
              Nothing yet.
            </Typography>
          )}
          {items.map((n) => (
            <Box
              key={n.id}
              onClick={() => open(n)}
              sx={{
                px: 2,
                py: 1.5,
                cursor: "pointer",
                bgcolor: n.read ? "transparent" : "action.hover",
                "&:hover": { bgcolor: "action.selected" },
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                {n.kind === "ai_suggestion" && <AutoAwesome fontSize="small" color="secondary" />}
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {n.title}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                {n.body}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.disabled" }}>
                {formatDateTime(n.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}

export default function AppLayout() {
  const { user, role, notifications } = useLoaderData<typeof appLoader>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const seen = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<UserNotification | null>(null);
  useEffect(() => {
    if (seen.current) {
      const fresh = notifications.find((n) => !seen.current!.has(n.id) && !n.read);
      if (fresh) setToast(fresh);
    }
    seen.current = new Set(notifications.map((n) => n.id));
  }, [notifications]);

  const reviewToast = async () => {
    if (!toast) return;
    await api.notifications.markRead(toast.id, user.id);
    navigate(`/deals/${toast.dealId}?tab=diligence`);
    setToast(null);
    revalidator.revalidate();
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar>
          <img src={logoUrl} width={24} height={24} style={{ marginRight: "0.5rem" }} />
          <Typography variant="h6" sx={{ flexGrow: 1, letterSpacing: -0.3 }}>
            Under
            <Box component="span" sx={{ color: "primary.main" }}>
              write
            </Box>
          </Typography>
          <Chip size="small" label={role.name} sx={{ mr: 1 }} />
          <NotificationsBell items={notifications} userId={user.id} />
          <IconButton
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="User menu"
            sx={{ ml: 0.5 }}
          >
            <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>
              {initials(user.name)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{user.name}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {user.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => submit(null, { method: "post", action: "/logout" })}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Log out / switch role
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List sx={{ p: 1.5 }}>
          {NAV.filter((n) => can(role, n.area)).map((n) => (
            <ListItemButton
              key={n.to}
              component={NavLink}
              to={n.to}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{n.icon}</ListItemIcon>
              <ListItemText primary={n.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={9000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast?.severity ?? "info"}
          icon={<AutoAwesome fontSize="inherit" />}
          variant="filled"
          onClose={() => setToast(null)}
          action={
            <Button color="inherit" size="small" onClick={reviewToast}>
              Review
            </Button>
          }
          sx={{ maxWidth: 440, alignItems: "center" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {toast?.title}
          </Typography>
          <Typography variant="body2">{toast?.body}</Typography>
        </Alert>
      </Snackbar>
    </Box>
  );
}
