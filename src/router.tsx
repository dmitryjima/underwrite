import { createBrowserRouter } from "react-router";
import AppLayout from "./layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DealsDashboardPage from "./pages/DealsDashboardPage";
import DealPage from "./pages/DealPage";
import MemoPage from "./pages/MemoPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import {
  appLoader,
  dashboardLoader,
  dealLoader,
  loginAction,
  loginLoader,
  logoutAction,
  memoLoader,
} from "./routes/loaders";

export const router = createBrowserRouter([
  { path: "/", loader: loginLoader, action: loginAction, element: <LoginPage /> },
  { path: "/logout", action: logoutAction },
  {
    id: "app",
    loader: appLoader,
    element: <AppLayout />,
    children: [
      { path: "deals/dashboard", loader: dashboardLoader, element: <DealsDashboardPage /> },
      { path: "deals/:dealId", loader: dealLoader, element: <DealPage /> },
      { path: "deals/:dealId/memo", loader: memoLoader, element: <MemoPage /> },
      { path: "team", element: <ComingSoonPage title="Team management" /> },
      { path: "settings", element: <ComingSoonPage title="Settings" /> },
    ],
  },
  {
    path: "*",
    loader: () => {
      throw new Response("", { status: 302, headers: { Location: "/" } });
    },
  },
]);
