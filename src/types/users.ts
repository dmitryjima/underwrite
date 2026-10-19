export const PERMISSION_AREAS = [
  "deals_dashboard",
  "deal_details",
  "deal_securities",
  "deal_due_diligence",
  "deal_documents",
  "deal_findings",
  "deal_ic_memo_preliminary",
  "deal_ic_memo_final",
  "team_management",
  "settings",
] as const;

export type TPermissionArea = (typeof PERMISSION_AREAS)[number];

export type TAccessLevel = "read" | "write";

export interface Permission {
  area: TPermissionArea;
  accessLevel: TAccessLevel;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  teamIds: string[];
}
