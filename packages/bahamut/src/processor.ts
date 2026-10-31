import type { Claims } from "./auth.js";
import type { Identity, Operation } from "./identity.js";

export interface Context {
  identity: Identity;
  op: Operation;
  /** Target id for retrieve/update/delete. */
  id?: string;
  parentId?: string;
  query: Record<string, unknown>;
  body: unknown;
  claims?: Claims;
  headers: Record<string, string | string[] | undefined>;
  output?: unknown;
  status?: number;
  events: Array<{ name: string; payload: unknown }>;
  setOutput(value: unknown, status?: number): void;
  pushEvent(name: string, payload: unknown): void;
}

// One small interface per operation; a processor implements only what it supports.
export interface RetrieveManyProcessor { processRetrieveMany(ctx: Context): Promise<void> }
export interface RetrieveProcessor { processRetrieve(ctx: Context): Promise<void> }
export interface CreateProcessor { processCreate(ctx: Context): Promise<void> }
export interface UpdateProcessor { processUpdate(ctx: Context): Promise<void> }
export interface DeleteProcessor { processDelete(ctx: Context): Promise<void> }

export type Processor = Partial<
  RetrieveManyProcessor & RetrieveProcessor & CreateProcessor & UpdateProcessor & DeleteProcessor
> & {
  /** Extra per-request authorization beyond the identity's auth level. */
  authorize?(ctx: Context): Promise<void> | void;
};

export const processorMethod: Record<Operation, keyof Processor> = {
  retrieveMany: "processRetrieveMany",
  retrieve: "processRetrieve",
  create: "processCreate",
  update: "processUpdate",
  delete: "processDelete",
};
