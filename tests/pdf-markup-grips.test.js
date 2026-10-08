import test from "node:test";
import assert from "node:assert/strict";
import { moveGrip } from "../src/grips.js";
import { inSelection } from "../src/selection.js";
const markup = {
  id: "sample",
  type: "pdfMarkup",
  points: [
    { x: 10, y: 20 },
    { x: 110, y: 70 },
  ],
};
test("special markup corner grips preserve aspect ratio and reject collapse", () => {
  const grown = moveGrip(markup, 1, { x: 210, y: 120 });
  assert.deepEqual(grown.points, [
    { x: 10, y: 20 },
    { x: 210, y: 120 },
  ]);
  assert.deepEqual(markup.points, [
    { x: 10, y: 20 },
    { x: 110, y: 70 },
  ]);
  const projected = moveGrip(markup, 1, { x: 210, y: 70 });
  assert.equal((projected.points[1].x - 10) / (projected.points[1].y - 20), 2);
  assert.throws(() => moveGrip(markup, 1, { x: 10, y: 20 }), /större/);
});
test("special markup supports window and crossing selection", () => {
  assert.equal(inSelection(markup, { x: 0, y: 0 }, { x: 120, y: 80 }), true);
  assert.equal(inSelection(markup, { x: 0, y: 0 }, { x: 100, y: 80 }), false);
  assert.equal(inSelection(markup, { x: 50, y: 40 }, { x: 40, y: 30 }), true);
});
