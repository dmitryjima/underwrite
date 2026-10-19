import type { ActivityEvent } from "../types/activity";
import type { Cycle } from "../types/cycles";
import type { Deal } from "../types/deals";
import type { DiligenceBlock } from "../types/diligence";
import type { DealDocument } from "../types/documents";
import type { Finding } from "../types/findings";
import type { Security } from "../types/securities";
import type { Role, User } from "../types/users";
import type { Adjustment } from "../types/adjustments";
import type { AppNotification } from "../types/notifications";
import type { ICMemo } from "../types/memos";
import { createSeed } from "../data/seed";

export interface Db {
  users: User[];
  roles: Role[];
  cycles: Cycle[];
  deals: Deal[];
  securities: Security[];
  diligenceBlocks: DiligenceBlock[];
  documents: DealDocument[];
  findings: Finding[];
  activity: ActivityEvent[];
  adjustments: Adjustment[];
  notifications: AppNotification[];
  memos: ICMemo[];
}

const KEY = "underwrite:db";
// Bump when seed data changes shape (in case of a deployed app)
const VERSION = 1;

export function readDb(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version: number; data: Db };
      if (parsed.version === VERSION) return parsed.data;
    }
  } catch (error) {
    console.error(error);
  }
  const seed = createSeed();
  writeDb(seed);
  return seed;
}

export function writeDb(data: Db) {
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data }));
}

export function resetDb() {
  localStorage.removeItem(KEY);
  sessionStorage.clear();
}
