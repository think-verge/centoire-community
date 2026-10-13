import { describe, expect, it } from "vitest";
import { CircleListQuerySchema, CreateCircleInputSchema } from "../schemas/community.js";

const base = { name: "Denim Lab", description: "All things denim" };

describe("CreateCircleInputSchema", () => {
  it("accepts 1-5 hashtag names", () => {
    expect(CreateCircleInputSchema.parse({ ...base, hashtags: ["denim", "#Selvedge"] }).hashtags).toHaveLength(2);
  });

  it("requires at least one hashtag", () => {
    expect(() => CreateCircleInputSchema.parse(base)).toThrow();
    expect(() => CreateCircleInputSchema.parse({ ...base, hashtags: [] })).toThrow();
  });

  it("caps hashtags at 5", () => {
    const names = ["aa", "bb", "cc", "dd", "ee", "ff"];
    expect(() => CreateCircleInputSchema.parse({ ...base, hashtags: names })).toThrow();
  });
});

describe("CircleListQuerySchema", () => {
  it("coerces and bounds limit", () => {
    expect(CircleListQuerySchema.parse({ limit: "20" }).limit).toBe(20);
    expect(() => CircleListQuerySchema.parse({ limit: "500" })).toThrow();
  });

  it("filters by hashtag", () => {
    expect(CircleListQuerySchema.parse({ hashtag: "denim" }).hashtag).toBe("denim");
  });
});
