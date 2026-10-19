import test from "node:test";
import assert from "node:assert/strict";
import { previewEntityDrag } from "../src/model/drag-geometry.js";
const line = (id, viewportId) => ({
  id,
  type: "line",
  points: [
    { x: 1, y: 2 },
    { x: 11, y: 2 },
  ],
  viewportId,
});
const drag = (id, grip = null) => ({
  id,
  ids: [id],
  grip,
  start: { x: 0, y: 0 },
});

test("drag previews are independent of event frequency and leave their source unchanged", () => {
  const before = { entities: [line("one")], scales: {} },
    original = structuredClone(before);
  previewEntityDrag(before, drag("one"), { x: 3, y: 4 });
  const final = previewEntityDrag(before, drag("one"), { x: 10, y: 20 });
  assert.deepEqual(final.entities[0].points[0], { x: 11, y: 22 });
  assert.deepEqual(before, original);
});

test("moving a viewport with a selected child translates that child exactly once", () => {
  const viewport = {
    id: "vp",
    type: "viewport",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
  };
  const before = {
    entities: [viewport, line("child", "vp"), line("outside")],
    scales: {},
  };
  for (const ids of [["vp"], ["vp", "child"]]) {
    const next = previewEntityDrag(
      before,
      { ...drag("vp"), ids },
      { x: 30, y: 20 },
    );
    assert.deepEqual(next.entities[1].points[0], { x: 31, y: 22 });
    assert.deepEqual(next.entities[2], before.entities[2]);
  }
});

test("block corner drags preserve proportions and invalid line grips are rejected", () => {
  const before = {
    entities: [
      {
        id: "block",
        type: "block",
        points: [{ x: 0, y: 0 }],
        blockWidth: 100,
        blockHeight: 50,
        rotation: 0,
      },
    ],
  };
  const next = previewEntityDrag(before, drag("block", 1), { x: 200, y: 100 });
  assert.equal(next.entities[0].blockWidth, 200);
  assert.equal(next.entities[0].blockHeight, 100);
  assert.equal(before.entities[0].blockWidth, 100);
  assert.throws(() =>
    previewEntityDrag({ entities: [line("one")] }, drag("one", 1), {
      x: -10,
      y: 0,
    }),
  );
});
