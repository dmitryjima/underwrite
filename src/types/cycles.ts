import type { EntityId, ISODateString, TEntityStatus } from "./common";

// Similar to sprint in Agile methodology, but renamed to avoid associations
export interface Cycle {
  id: EntityId;
  name: string;
  startDate: ISODateString;
  endDate: ISODateString;
  status: TEntityStatus;
  description?: string;
}
