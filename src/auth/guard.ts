import { redirect } from "react-router";
import { api } from "../api/client";

// "Middleware" for react-router loaders
export async function requireAuth() {
  const me = await api.auth.me();
  if (!me) throw redirect("/");
  return me;
}
