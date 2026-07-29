import { describe, expect, it } from "vitest";
import { seededShuffle } from "./shuffle.js";

describe("seededShuffle", () => {
  it("is deterministic for the same seed and salt", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, "session-abc", "questions");
    const b = seededShuffle(items, "session-abc", "questions");
    expect(a).toEqual(b);
  });

  it("diverges for a different session seed (two students don't share an order)", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, "session-abc", "questions");
    const b = seededShuffle(items, "session-xyz", "questions");
    expect(a).not.toEqual(b);
  });

  it("diverges for a different salt on the same seed (question order != option order)", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, "session-abc", "questions");
    const b = seededShuffle(items, "session-abc", "options");
    expect(a).not.toEqual(b);
  });

  it("never drops or duplicates items", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = seededShuffle(items, "session-abc", "questions");
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
  });

  it("does not mutate the input array", () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    seededShuffle(items, "session-abc", "questions");
    expect(items).toEqual(copy);
  });
});
