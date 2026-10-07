import { describe, expect, it } from "vitest";
import {
  CircleListQuerySchema,
  CreateCircleInputSchema,
} from "../schemas/community.js";

const base = { name: "Denim Lab", description: "All things denim" };

describe("CreateCircleInputSchema", () => {
  it("accepts real ObjectId tagIds and custom tagNames", () => {
    const parsed = CreateCircleInputSchema.parse({
      ...base,
      tagIds: ["64b7f0c2a1b2c3d4e5f60718"],
      tagNames: ["  Selvedge "],
    });
    expect(parsed.tagNames).toEqual(["Selvedge"]);
  });

  it("rejects non-ObjectId tag ids such as the old custom-* placeholders", () => {
    expect(() => CreateCircleInputSchema.parse({ ...base, tagIds: ["custom-design"] })).toThrow();
  });

  it("requires at least one topic", () => {
    expect(() => CreateCircleInputSchema.parse(base)).toThrow(/at least one topic/);
    expect(() => CreateCircleInputSchema.parse({ ...base, tagIds: [], tagNames: [] })).toThrow();
  });

  it("caps each tag list at 5", () => {
    const names = ["a", "b", "c", "d", "e", "f"];
    expect(() => CreateCircleInputSchema.parse({ ...base, tagNames: names })).toThrow();
  });
});

describe("CircleListQuerySchema", () => {
  it("coerces and bounds limit", () => {
    expect(CircleListQuerySchema.parse({ limit: "20" }).limit).toBe(20);
    expect(() => CircleListQuerySchema.parse({ limit: "500" })).toThrow();
  });
});
