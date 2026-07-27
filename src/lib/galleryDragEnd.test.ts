import { describe, expect, it } from "vitest";
import { computeDragEndState, idsKey, type DragEndState } from "./galleryDragEnd";

// Scope note: this suite covers computeDragEndState/idsKey as pure functions
// only. Full pointer-drag-simulation end-to-end tests against @dnd-kit are
// a deliberate scope cut (flaky, poor ROI here), not an oversight.

function baseState(overrides: Partial<DragEndState> = {}): DragEndState {
  return {
    unsortedOrder: ["a1", "a2", "a3"],
    boardOrder: ["b1", "b2"],
    boardAssetIds: {},
    ...overrides,
  };
}

describe("computeDragEndState", () => {
  it("reorders an asset within the Unsorted grid", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "a1", type: "asset" },
      { id: "a3", type: "asset" }
    );
    expect(next.unsortedOrder).toEqual(["a2", "a3", "a1"]);
    expect(next.boardOrder).toBe(state.boardOrder);
  });

  it("moves an asset onto a board", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "a1", type: "asset" },
      { id: "b1", type: "board", boardId: "b1" }
    );
    expect(next.unsortedOrder).toEqual(["a2", "a3"]);
    expect(next.boardAssetIds.b1).toEqual(["a1"]);
  });

  it("appends to a board that already has assets", () => {
    const state = baseState({ boardAssetIds: { b1: ["a9"] } });
    const next = computeDragEndState(
      state,
      { id: "a1", type: "asset" },
      { id: "b1", type: "board", boardId: "b1" }
    );
    expect(next.boardAssetIds.b1).toEqual(["a9", "a1"]);
  });

  it("reorders a board among the other boards", () => {
    const state = baseState({ boardOrder: ["b1", "b2", "b3"] });
    const next = computeDragEndState(
      state,
      { id: "b1", type: "board" },
      { id: "b3", type: "board" }
    );
    expect(next.boardOrder).toEqual(["b2", "b3", "b1"]);
    expect(next.unsortedOrder).toBe(state.unsortedOrder);
  });

  it("is a no-op when a board is dragged over an asset", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "b1", type: "board" },
      { id: "a1", type: "asset" }
    );
    expect(next).toBe(state);
  });

  it("is a no-op when there is no drop target", () => {
    const state = baseState();
    const next = computeDragEndState(state, { id: "a1", type: "asset" }, null);
    expect(next).toBe(state);
  });

  it("is a no-op when dropped on itself", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "a1", type: "asset" },
      { id: "a1", type: "asset" }
    );
    expect(next).toBe(state);
  });

  it("is a no-op when the active id isn't found in its expected list", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "missing", type: "asset" },
      { id: "a1", type: "asset" }
    );
    expect(next).toBe(state);
  });

  it("is a no-op when over has an unrecognized type", () => {
    const state = baseState();
    const next = computeDragEndState(
      state,
      { id: "a1", type: "asset" },
      { id: "a2", type: undefined }
    );
    expect(next).toBe(state);
  });
});

describe("idsKey", () => {
  it("produces the same key for the same id set", () => {
    expect(idsKey(["a1", "a2", "a3"])).toBe(idsKey(["a1", "a2", "a3"]));
  });

  it("produces a different key when the id set changes", () => {
    expect(idsKey(["a1", "a2"])).not.toBe(idsKey(["a1", "a2", "a3"]));
  });

  it("is sensitive to order (a genuinely different sequence reseeds)", () => {
    expect(idsKey(["a1", "a2"])).not.toBe(idsKey(["a2", "a1"]));
  });
});
