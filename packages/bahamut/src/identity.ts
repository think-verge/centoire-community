import type { ZodType } from "zod";

export type Operation = "retrieveMany" | "retrieve" | "create" | "update" | "delete";
export type AuthLevel = "none" | "user" | "admin";

export interface Identity {
  /** Singular model name, e.g. "notification". */
  name: string;
  /** URL segment under the API prefix, e.g. "notifications". */
  category: string;
  /** Owning service (analog of the elemental spec `package`). */
  package: string;
  /** Optional parent identity for /:parent/:id/:category routes. */
  parent?: string;
  /** Required auth per operation; unspecified operations default to "user". */
  auth?: Partial<Record<Operation, AuthLevel>>;
  /** Operations hidden from the public gateway listener. */
  private?: Operation[];
  schemas?: { create?: ZodType; update?: ZodType; query?: ZodType };
}

// Global registry — the analog of the elemental model Manager.
const registry = new Map<string, Identity>();

export function defineIdentity(identity: Identity): Identity {
  registry.set(identity.category, identity);
  return identity;
}

export function identityByCategory(category: string): Identity | undefined {
  return registry.get(category);
}

export function identitiesInPackage(pkg: string): Identity[] {
  return [...registry.values()].filter((i) => i.package === pkg);
}
