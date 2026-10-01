import test from "node:test";
import assert from "node:assert/strict";
import { exactPoint, referenceValue } from "../src/command-input.js";
import { trimLine } from "../src/advanced-editing.js";
import { offsetEntity } from "../src/editing.js";
import { toCad } from "../src/cad-geometry.js";
const line = (id, a, b) => ({
  id,
  type: "line",
  points: [a, b],
  page: 1,
  color: "#147b60",
  width: 1,
  fontSize: 12,
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("precise coordinates use mm, positive Y upward, origin and decimal comma without angle drift", () => {
  const context = {
    base: { x: 20, y: 50 },
    origin: { x: 10, y: 100 },
    scale: 10,
  };
  assert.deepEqual(exactPoint("@500,200", context), { x: 70, y: 30 });
  assert.deepEqual(exactPoint("#500;200", context), { x: 60, y: 80 });
  assert.deepEqual(exactPoint("@12,5;25,5", context), { x: 21.25, y: 47.45 });
  const p = exactPoint("500<90", context);
  near(p.x, 20);
  near(p.y, 0);
  assert.throws(() => exactPoint("@5,2", { scale: 1 }));
  assert.throws(() => exactPoint("5<30", { base: { x: 0, y: 0 } }));
  assert.throws(() => exactPoint("5<xx", context));
  assert.equal(referenceValue("scale", 100, 250), 2.5);
  near(referenceValue("rotate", Math.PI / 4, Math.PI / 2), Math.PI / 4);
  assert.throws(() => referenceValue("scale", 0, 10));
});
test("line trims against circle and arc using analytic intersections", () => {
  const l = line("l", { x: 0, y: 0 }, { x: 100, y: 0 });
  const c = {
    ...l,
    id: "c",
    type: "circle",
    points: [
      { x: 50, y: 0 },
      { x: 60, y: 0 },
    ],
  };
  const result = trimLine(l, [c], { x: 50, y: 0 });
  assert.equal(result.length, 2);
  near(result[0].points[1].x, 40);
  near(result[1].points[0].x, 60);
  const arc = {
    ...c,
    type: "arc",
    points: [
      { x: 40, y: 0 },
      { x: 50, y: -10 },
      { x: 60, y: 0 },
    ],
  };
  assert.equal(trimLine(l, [arc], { x: 50, y: 0 }).length, 2);
  const short = line("s", { x: 0, y: 0 }, { x: 20, y: 0 });
  near(trimLine(short, [c], { x: 19, y: 0 }, true)[0].points[1].x, 40);
});
test("arc trimming and extension preserve actual curves", () => {
  const arc = {
    ...line("a", { x: 10, y: 0 }, { x: 0, y: 10 }),
    type: "arc",
    points: [
      { x: 10, y: 0 },
      { x: Math.sqrt(50), y: Math.sqrt(50) },
      { x: 0, y: 10 },
    ],
  };
  const extended = trimLine(
    arc,
    [line("b", { x: -5, y: 0 }, { x: -5, y: 20 })],
    { x: 0, y: 10 },
    true,
  )[0];
  near(extended.points[2].x, -5);
  near(toCad(extended).radius, 10);
  const trimmed = trimLine(arc, [line("b", { x: 5, y: 0 }, { x: 5, y: 20 })], {
    x: 9,
    y: 3,
  })[0];
  near(trimmed.points[0].x, 5);
  near(toCad(trimmed).radius, 10);
});
test("offset arc preserves sweep and rejects collapsed radius; open and closed polyline offsets", () => {
  const arc = {
    ...line("a", { x: 10, y: 0 }, { x: 0, y: 10 }),
    type: "arc",
    points: [
      { x: 10, y: 0 },
      { x: Math.sqrt(50), y: Math.sqrt(50) },
      { x: 0, y: 10 },
    ],
  };
  const moved = offsetEntity(arc, 2, { x: 20, y: 20 });
  near(toCad(moved).radius, 12);
  near(toCad(moved).sweep, toCad(arc).sweep);
  assert.throws(() => offsetEntity(arc, 11, { x: 0, y: 0 }));
  const path = {
    ...arc,
    type: "polyline",
    closed: false,
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ],
  };
  const o = offsetEntity(path, 2, { x: 10, y: 5 });
  assert.deepEqual(o.points, [
    { x: 0, y: 2 },
    { x: 18, y: 2 },
    { x: 18, y: 20 },
  ]);
  const square = {
    ...path,
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ],
  };
  const inward = offsetEntity(square, 2, { x: 10, y: 10 });
  assert.deepEqual(inward.points, [
    { x: 2, y: 2 },
    { x: 18, y: 2 },
    { x: 18, y: 18 },
    { x: 2, y: 18 },
  ]);
  assert.throws(() => offsetEntity(square, 11, { x: 10, y: 10 }));
});

test("circle trim removes clicked interval including wrap-around and preserves attributes", () => {
  const c = {
    ...line("c", { x: 0, y: 0 }, { x: 10, y: 0 }),
    type: "circle",
    viewportId: "v",
  };
  const boundary = line("b", { x: 5, y: -20 }, { x: 5, y: 20 });
  const kept = trimLine(c, [boundary], { x: 10, y: 0 })[0];
  assert.equal(kept.type, "arc");
  assert.equal(kept.viewportId, "v");
  near(toCad(kept).radius, 10);
  near(toCad(kept).sweep, (4 * Math.PI) / 3);
  const other = trimLine(c, [boundary], { x: -10, y: 0 })[0];
  near(toCad(other).sweep, (2 * Math.PI) / 3);
  const tangent = line("t", { x: 10, y: -20 }, { x: 10, y: 20 });
  assert.throws(() => trimLine(c, [tangent], { x: -10, y: 0 }));
  assert.throws(() => trimLine(c, [boundary], { x: 10, y: 0 }, true));
  const next = trimLine(kept, [line("d", { x: -20, y: 0 }, { x: 20, y: 0 })], {
    x: 0,
    y: 10,
  });
  assert.equal(next.length, 1);
  near(toCad(next[0]).radius, 10);
});

import { moveGrip, gripLengthPoint } from "../src/grips.js";
test("grips preserve circle radius on center move, accept scaled lengths and reject degenerate curves", () => {
  const c = { ...line("c", { x: 0, y: 0 }, { x: 10, y: 0 }), type: "circle" };
  const moved = moveGrip(c, 0, { x: 20, y: 30 });
  near(toCad(moved).radius, 10);
  assert.deepEqual(c.points[0], { x: 0, y: 0 });
  const radius = gripLengthPoint(c, 1, 5000, 100);
  near(toCad(moveGrip(c, 1, radius)).radius, 50);
  const l = line("l", { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.deepEqual(gripLengthPoint(l, 0, 2000, 100), { x: -10, y: 0 });
  assert.throws(() => moveGrip(l, 1, l.points[0]));
  assert.throws(() => gripLengthPoint(c, 1, 0, 1));
  assert.throws(() => gripLengthPoint(c, 1, 10, undefined));
  const arc = {
    ...l,
    type: "arc",
    points: [
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    ],
  };
  assert.throws(() => moveGrip(arc, 1, { x: 0, y: 0 }));
  near(toCad(moveGrip(arc, 1, { x: 0, y: 20 })).radius, 12.5);
});
