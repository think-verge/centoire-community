import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { INotification } from "./model.js";
import { serialize } from "./serialize.js";

const base = {
  _id: new Types.ObjectId("6ae5da5d77f6e81f376f0e50"),
  type: "comment.replied",
  createdAt: new Date("2026-10-31T10:00:00.000Z"),
} as unknown as INotification;

describe("serialize (wire format the generated UI client depends on)", () => {
  it("renders snapshots into the actor / targetPost / targetCircle shapes", () => {
    const out = serialize({
      ...base,
      actor: { id: "u1", displayName: "Ada", handle: "ada", avatarUrl: "https://x/a.png" },
      targetPost: { id: "p1", slug: "a-post", title: "A post" },
      targetCircle: { id: "c1", slug: "linen", name: "Linen", avatarUrl: "https://x/c.png" },
      targetInviteToken: "tok",
      readAt: new Date("2026-10-31T11:00:00.000Z"),
    } as unknown as INotification);

    expect(out).toEqual({
      id: "6ae5da5d77f6e81f376f0e50",
      type: "comment.replied",
      actor: { id: "u1", handle: "ada", displayName: "Ada", avatarUrl: "https://x/a.png" },
      targetPost: { id: "p1", slug: "a-post", title: "A post" },
      targetCircle: { id: "c1", slug: "linen", name: "Linen", avatarUrl: "https://x/c.png" },
      targetInviteToken: "tok",
      readAt: "2026-10-31T11:00:00.000Z",
      createdAt: "2026-10-31T10:00:00.000Z",
    });
  });

  it("uses explicit nulls (never undefined) for anything missing, and tolerates sparse snapshots", () => {
    const out = serialize({ ...base, actor: { id: "u1" }, targetPost: { id: "p1" } } as unknown as INotification);
    expect(out.actor).toEqual({ id: "u1", handle: null, displayName: "", avatarUrl: null });
    expect(out.targetPost).toEqual({ id: "p1", slug: "", title: "" });
    expect(out.targetCircle).toBeNull();
    expect(out.targetInviteToken).toBeNull();
    expect(out.readAt).toBeNull();
  });
});
