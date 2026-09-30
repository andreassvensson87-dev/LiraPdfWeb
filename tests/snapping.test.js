import test from "node:test";
import assert from "node:assert/strict";
import { extractSegments, nearestSnap } from "../src/pdf-snapping.js";
import { primitives, validateProject } from "../src/core.js";
const ops = {
  save: 1,
  restore: 2,
  transform: 3,
  constructPath: 4,
  paintFormXObjectBegin: 5,
  paintFormXObjectEnd: 6,
  endPath: 7,
};
test("PDF paths use graphics transforms, viewport rotation and restore", () => {
  const paths = {
    fnArray: [1, 3, 4, 2, 4],
    argsArray: [
      [],
      [2, 0, 0, 2, 10, 20],
      [8, [new Float32Array([0, 0, 0, 1, 10, 0])], []],
      [],
      [8, [new Float32Array([0, 0, 0, 1, 10, 0])], []],
    ],
  };
  assert.deepEqual(extractSegments(paths, ops, [0, 1, 1, 0, 0, 0]), [
    { a: { x: 20, y: 10 }, b: { x: 20, y: 30 } },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
  ]);
});
test("PDF forms, closed paths and curves do not introduce false chords", () => {
  const list = {
    fnArray: [5, 4, 6],
    argsArray: [
      [[1, 0, 0, 1, 10, 0]],
      [
        8,
        [
          new Float32Array([
            0, 0, 0, 1, 10, 0, 2, 11, 1, 12, 2, 10, 10, 1, 0, 10, 4,
          ]),
        ],
        [],
      ],
      [],
    ],
  };
  const lines = extractSegments(list, ops, [1, 0, 0, 1, 0, 0]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[1], { a: { x: 20, y: 10 }, b: { x: 10, y: 10 } });
});
test("snap prioritizes endpoints and midpoints; nearest edge is clamped", () => {
  const s = [{ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }];
  assert.equal(nearestSnap({ x: 2, y: 2 }, s, 5).kind, "Ändpunkt");
  assert.equal(nearestSnap({ x: 49, y: 2 }, s, 5).kind, "Mittpunkt");
  assert.deepEqual(nearestSnap({ x: 30, y: 3 }, s, 5).point, { x: 30, y: 0 });
  assert.equal(nearestSnap({ x: 30, y: 10 }, s, 5), null);
});
test("mask stores a filled rectangle and survives project validation", () => {
  const e = {
    id: "m",
    type: "mask",
    page: 1,
    points: [
      { x: 30, y: 40 },
      { x: 10, y: 20 },
    ],
    color: "#ffffff",
    width: 1,
    fontSize: 12,
  };
  assert.deepEqual(primitives(e, 1), [
    { kind: "fill", rect: { x: 10, y: 20, w: 20, h: 20 }, color: "#ffffff" },
  ]);
  assert.ok(
    validateProject({
      format: "lirapdf",
      version: 1,
      pdf: "x",
      entities: [e],
      scales: {},
    }),
  );
});

test("line picking finds nearest finite segment, preserving original geometry", async () => {
  const { nearestSegment } = await import("../src/pdf-snapping.js");
  const segments = [
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { a: { x: 20, y: 10 }, b: { x: 20, y: 60 } },
  ];
  const original = structuredClone(segments);
  assert.equal(nearestSegment({ x: 40, y: 2 }, segments, 5), segments[0]);
  assert.equal(nearestSegment({ x: 22, y: 30 }, segments, 5), segments[1]);
  assert.equal(nearestSegment({ x: 110, y: 0 }, segments, 5), null);
  assert.deepEqual(segments, original);
});
