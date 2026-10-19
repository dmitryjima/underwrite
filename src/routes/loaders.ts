import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { api } from "../api/client";
import { requireAuth } from "../auth/guard";
import type { TDealStage } from "../types/deals";
import type { TRiskLevel } from "../types/common";
import type { DealSortKey } from "../api/client";

export const SORT_KEYS: DealSortKey[] = [
  "name",
  "stage",
  "amount",
  "risk",
  "readiness",
  "icDate",
  "updatedAt",
];

export async function loginLoader() {
  return { personas: await api.auth.listDemoPersonas() };
}

export async function loginAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  await api.auth.login(String(form.get("userId")));
  return redirect("/deals/dashboard");
}

export async function logoutAction() {
  api.auth.logout();
  return redirect("/");
}

export async function appLoader() {
  const me = await requireAuth();
  const notifications = await api.notifications.listFor(me.user.id);
  return { ...me, notifications };
}

export async function memoLoader({ params }: LoaderFunctionArgs) {
  await requireAuth();
  const bundle = await api.memos.bundle(params.dealId!);
  if (!bundle) throw new Response("Deal not found", { status: 404 });
  return { ...bundle, users: await api.users.list() };
}

// For the deals dashboard
export function parseFilters(sp: URLSearchParams) {
  const list = (k: string) => sp.get(k)?.split(",").filter(Boolean) ?? [];
  const sort = sp.get("sort") as DealSortKey | null;
  return {
    cycle: sp.get("cycle") ?? "",
    view: sp.get("view") === "kanban" ? ("kanban" as const) : ("table" as const),
    q: sp.get("q") ?? "",
    stages: list("stage") as TDealStage[],
    risks: list("risk") as TRiskLevel[],
    owner: sp.get("owner") ?? "",
    sort: sort && SORT_KEYS.includes(sort) ? sort : ("updatedAt" as DealSortKey),
    dir: sp.get("dir") === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

export async function dashboardLoader({ request }: LoaderFunctionArgs) {
  await requireAuth();
  const url = new URL(request.url);
  const cycles = await api.cycles.list();

  // Cycles/sprints might be not the most conventional approach among investement teams
  // so for this demo we default to "all"
  if (!url.searchParams.has("cycle")) {
    url.searchParams.set("cycle", "all");
    throw redirect(url.pathname + url.search);
  }

  const filters = parseFilters(url.searchParams);
  const [users, list] = await Promise.all([
    api.users.list(),
    api.deals.list({
      cycleId: filters.cycle,
      q: filters.q,
      stages: filters.stages,
      risks: filters.risks,
      ownerId: filters.owner,
      sort: filters.sort,
      dir: filters.dir,
    }),
  ]);
  return { filters, cycles, users, list };
}

export async function dealLoader({ params }: LoaderFunctionArgs) {
  await requireAuth();
  const bundle = await api.deals.getBundle(params.dealId!);
  if (!bundle) throw new Response("Deal not found", { status: 404 });
  return { ...bundle, users: await api.users.list() };
}
