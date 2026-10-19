import type { Role, TAccessLevel, TPermissionArea } from "../types/users";

// A read/write access helper
export function can(role: Role | undefined, area: TPermissionArea, level: TAccessLevel = "read") {
  const p = role?.permissions.find((x) => x.area === area);
  if (!p) return false;
  return level === "read" || p.accessLevel === "write";
}
