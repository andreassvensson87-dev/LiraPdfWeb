import test from "node:test";
import assert from "node:assert/strict";
import { translateEntity, offsetEntity } from "../src/editing.js";
const line = {
  id: "a",
  type: "line",
  viewportId: "v",
  points: [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
  ],
  textAnchor: { x: 40, y: 50 },
};
test("move and copy geometry retain viewport ownership and do not mutate original", () => {
  const moved = translateEntity(line, { x: 10, y: 20 }, { x: 30, y: 50 });
  assert.deepEqual(moved.points, [
    { x: 30, y: 50 },
    { x: 130, y: 50 },
  ]);
  assert.deepEqual(moved.textAnchor, { x: 60, y: 80 });
  assert.equal(moved.viewportId, "v");
  assert.equal(line.points[0].x, 10);
});
test("line offset works on either side for horizontal and diagonal segments", () => {
  assert.equal(offsetEntity(line, 5, { x: 50, y: 30 }).points[0].y, 25);
  assert.equal(offsetEntity(line, 5, { x: 50, y: 10 }).points[0].y, 15);
  const diagonal = {
    ...line,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  };
  const o = offsetEntity(diagonal, Math.sqrt(2), { x: 0, y: 10 });
  assert.ok(Math.abs(o.points[0].x + 1) < 1e-8);
  assert.ok(Math.abs(o.points[0].y - 1) < 1e-8);
});
test("circle and rectangle offsets reject inward collapse", () => {
  const circle = {
    type: "circle",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
  };
  assert.deepEqual(offsetEntity(circle, 2, { x: 0, y: 0 }).points[1], {
    x: 8,
    y: 0,
  });
  assert.deepEqual(offsetEntity(circle, 2, { x: 20, y: 0 }).points[1], {
    x: 12,
    y: 0,
  });
  assert.throws(() => offsetEntity(circle, 10, { x: 0, y: 0 }));
  const rect = {
    type: "rect",
    points: [
      { x: 10, y: 20 },
      { x: 0, y: 0 },
    ],
  };
  assert.deepEqual(offsetEntity(rect, 2, { x: 30, y: 30 }).points, [
    { x: -2, y: -2 },
    { x: 12, y: 22 },
  ]);
  assert.throws(() => offsetEntity(rect, 5, { x: 5, y: 5 }));
  assert.throws(() => offsetEntity(line, Infinity, { x: 0, y: 0 }));
});
