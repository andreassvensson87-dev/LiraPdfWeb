import test from "node:test";
import assert from "node:assert/strict";
import { inSelection, mergeSelection } from "../src/selection.js";
const line = {
  type: "line",
  points: [
    { x: 0, y: 10 },
    { x: 100, y: 10 },
  ],
  width: 1,
  fontSize: 12,
};
test("window requires whole object; crossing picks crossed line even with both endpoints outside", () => {
  assert.equal(inSelection(line, { x: 20, y: 0 }, { x: 80, y: 20 }), false);
  assert.equal(inSelection(line, { x: 80, y: 0 }, { x: 20, y: 20 }), true);
  assert.equal(inSelection(line, { x: -1, y: 0 }, { x: 101, y: 20 }), true);
  assert.equal(inSelection(line, { x: 80, y: 30 }, { x: 20, y: 40 }), false);
});
test("crossing uses actual geometry rather than overlapping bounding boxes", () => {
  const diagonal = {
    ...line,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
  };
  assert.equal(inSelection(diagonal, { x: 90, y: 0 }, { x: 80, y: 10 }), false);
  const rect = {
    ...line,
    type: "rect",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
  };
  assert.equal(inSelection(rect, { x: 80, y: 20 }, { x: 20, y: 80 }), false);
  assert.equal(
    inSelection({ ...rect, type: "mask" }, { x: 80, y: 20 }, { x: 20, y: 80 }),
    true,
  );
});
test("circle and arc containment checks rendered geometry, not control points", () => {
  const circle = {
    ...line,
    type: "circle",
    points: [
      { x: 50, y: 50 },
      { x: 70, y: 50 },
    ],
  };
  assert.equal(inSelection(circle, { x: 45, y: 45 }, { x: 75, y: 55 }), false);
  assert.equal(inSelection(circle, { x: 25, y: 25 }, { x: 75, y: 75 }), true);
  assert.equal(inSelection(circle, { x: 55, y: 25 }, { x: 45, y: 35 }), true);
});
test("real text bounds and transformed block polygons participate in selection", () => {
  const text = {
    ...line,
    type: "text",
    points: [{ x: 10, y: 20 }],
    text: "abc",
  };
  assert.equal(
    inSelection(text, { x: 0, y: 0 }, { x: 60, y: 30 }, 1, [
      { x: 10, y: 10, w: 80, h: 12 },
    ]),
    false,
  );
  assert.equal(
    inSelection(text, { x: 60, y: 0 }, { x: 30, y: 30 }, 1, [
      { x: 10, y: 10, w: 80, h: 12 },
    ]),
    true,
  );
  const block = {
    type: "block",
    points: [{ x: 0, y: 0 }],
    blockWidth: 100,
    blockHeight: 100,
    rotation: 45,
  };
  assert.equal(inSelection(block, { x: 5, y: 55 }, { x: -5, y: 65 }), true);
  assert.equal(
    inSelection({ type: "pdfErase" }, { x: 10, y: 0 }, { x: 0, y: 10 }),
    false,
  );
});
test("replace add remove selection preserves uniqueness", () => {
  assert.deepEqual(mergeSelection(["a"], ["b"]), ["b"]);
  assert.deepEqual(mergeSelection(["a"], ["a", "b"], "add"), ["a", "b"]);
  assert.deepEqual(mergeSelection(["a", "b"], ["a"], "remove"), ["b"]);
});
