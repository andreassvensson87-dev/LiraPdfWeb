import test from "node:test";
import assert from "node:assert/strict";
import {
  arcPoints,
  dimension,
  distance,
  constrain,
  primitives,
  validateProject,
} from "../src/core.js";
test("arc passes through three points and rejects collinear input", () => {
  const a = { x: 1, y: 0 },
    b = { x: 0, y: 1 },
    c = { x: -1, y: 0 };
  const ps = arcPoints(a, b, c);
  assert.ok(distance(ps[0], a) < 1e-8);
  assert.ok(distance(ps[32], b) < 1e-8);
  assert.ok(distance(ps.at(-1), c) < 1e-8);
  assert.throws(() =>
    arcPoints({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }),
  );
});
test("dimension offset leaves source geometry and measured distance intact", () => {
  const a = { x: 0, y: 0 },
    b = { x: 3, y: 4 };
  const { p, q } = dimension(a, b, { x: 10, y: 0 });
  assert.ok(Math.abs(distance(p, q) - 5) < 1e-9);
  assert.throws(() => dimension(a, a, b));
  const shapes = primitives(
    { type: "dim", points: [a, b, { x: 10, y: 0 }], fontSize: 12 },
    100,
  );
  assert.equal(shapes.at(-1).value, "500 mm");
});
test("exact calibrated length works with ortho and free angle", () => {
  assert.deepEqual(constrain({ x: 0, y: 0 }, { x: 8, y: 3 }, true, 100, 10), {
    x: 10,
    y: 0,
  });
  assert.ok(
    Math.abs(
      distance(
        { x: 0, y: 0 },
        constrain({ x: 0, y: 0 }, { x: 3, y: 4 }, false, 100, 10),
      ) - 10,
    ) < 1e-9,
  );
});
test("project rejects invalid coordinates and duplicate identities", () => {
  const e = {
    id: "one",
    type: "line",
    page: 1,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    color: "#147b60",
    width: 1,
    fontSize: 12,
  };
  const p = {
    format: "lirapdf",
    version: 1,
    pdf: "abc",
    entities: [e],
    scales: { 1: 20 },
  };
  assert.equal(validateProject(p), p);
  assert.throws(() => validateProject({ ...p, entities: [e, e] }));
  assert.throws(() => validateProject({ ...p, scales: { 1: 0 } }));
  assert.throws(() =>
    validateProject({
      ...p,
      entities: [
        {
          ...e,
          points: [
            { x: NaN, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    }),
  );
});
