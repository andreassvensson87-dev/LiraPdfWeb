import test from "node:test";
import assert from "node:assert/strict";
import {
  transformEntity,
  joinEntities,
  explodeEntity,
  vertexEdit,
  trimLine,
  cornerLines,
} from "../src/advanced-editing.js";
import { primitives, validateProject, distance } from "../src/core.js";
const line = (id, a, b) => ({
  id,
  type: "line",
  page: 1,
  points: [a, b],
  color: "#123456",
  width: 1,
  fontSize: 12,
  viewportId: "v",
});
const a = line("a", { x: 0, y: 0 }, { x: 100, y: 0 });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("rotate scale mirror preserve geometry and ownership; rotated rectangles become exact polylines", () => {
  const r = transformEntity(
    a,
    "rotate",
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    -Math.PI / 2,
  );
  close(r.points[1].x, 0);
  close(r.points[1].y, -100);
  const m = transformEntity(a, "mirror", { x: 0, y: 0 }, { x: 1, y: 1 });
  close(m.points[1].x, 0);
  close(m.points[1].y, 100);
  assert.equal(m.viewportId, "v");
  const s = transformEntity(a, "scale", { x: 10, y: 0 }, { x: 0, y: 0 }, 2);
  assert.deepEqual(s.points, [
    { x: -10, y: 0 },
    { x: 190, y: 0 },
  ]);
  const rect = {
    ...a,
    type: "rect",
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ],
  };
  const rotated = transformEntity(
    rect,
    "rotate",
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  );
  assert.equal(rotated.type, "polyline");
  assert.equal(primitives(rotated, 1).length, 4);
  close(distance(rotated.points[0], rotated.points[1]), 20);
  assert.throws(() =>
    transformEntity(a, "scale", { x: 0, y: 0 }, { x: 0, y: 0 }, 0),
  );
  assert.throws(() =>
    transformEntity(a, "mirror", { x: 0, y: 0 }, { x: 0, y: 0 }),
  );
});
test("join unordered reversed segments then explode; project validation and SVG/export primitives retain closed path", () => {
  const b = line("b", { x: 100, y: 100 }, { x: 100, y: 0 }),
    c = line("c", { x: 0, y: 0 }, { x: 100, y: 100 });
  const joined = joinEntities([a, c, b]);
  assert.equal(joined.closed, true);
  assert.equal(joined.points.length, 3);
  assert.equal(explodeEntity(joined).length, 3);
  const frame = {
    ...a,
    id: "v",
    type: "viewport",
    viewportId: undefined,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 200 },
    ],
    denominator: 100,
  };
  const project = {
    format: "lirapdf",
    version: 1,
    pdf: "AA==",
    entities: [frame, joined],
    scales: {},
  };
  assert.equal(validateProject(project), project);
  assert.throws(() => joinEntities([a, { ...b, viewportId: "other" }]));
  assert.throws(() =>
    joinEntities([a, line("z", { x: 300, y: 0 }, { x: 500, y: 0 })]),
  );
});
test("vertex insertion and removal keep minimum valid contour", () => {
  const rect = {
    ...a,
    type: "rect",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
  };
  const added = vertexEdit(rect, { x: 50, y: -20 });
  assert.equal(added.points.length, 5);
  const removed = vertexEdit(added, { x: 50, y: -20 }, true);
  assert.equal(removed.points.length, 4);
  const triangle = vertexEdit(removed, { x: 0, y: 0 }, true);
  assert.equal(triangle.points.length, 3);
  assert.throws(() => vertexEdit(triangle, { x: 0, y: 0 }, true));
});
test("trim removes picked interval while extend reaches nearest boundary on picked end", () => {
  const bounds = [
    line("b", { x: 30, y: -10 }, { x: 30, y: 10 }),
    line("c", { x: 70, y: -10 }, { x: 70, y: 10 }),
  ];
  const trimmed = trimLine(a, bounds, { x: 50, y: 0 });
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0].points[1].x, 30);
  assert.equal(trimmed[1].points[0].x, 70);
  assert.equal(trimLine(a, bounds, { x: 5, y: 0 })[0].points[0].x, 30);
  const extended = trimLine(
    a,
    [
      line("d", { x: 150, y: -10 }, { x: 150, y: 10 }),
      line("e", { x: 200, y: -10 }, { x: 200, y: 10 }),
    ],
    { x: 95, y: 0 },
    true,
  );
  assert.equal(extended[0].points[1].x, 150);
  assert.throws(() => trimLine(a, bounds, { x: 0, y: 0 }, true));
  assert.throws(() => trimLine(a, [a], { x: 20, y: 0 }));
});
test("fillet and chamfer trim both lines, preserve metadata and reject oversized corners", () => {
  const b = line("b", { x: 0, y: 0 }, { x: 0, y: 100 });
  const f = cornerLines(a, b, { x: 90, y: 0 }, { x: 0, y: 90 }, 10, true);
  close(f.updated[0].points[0].x, 10);
  close(f.updated[1].points[0].y, 10);
  assert.equal(f.bridge.type, "arc");
  assert.equal(f.bridge.viewportId, "v");
  assert.ok(primitives(f.bridge, 1).length > 0);
  const chamfer = cornerLines(
    a,
    b,
    { x: 90, y: 0 },
    { x: 0, y: 90 },
    20,
    false,
  );
  assert.deepEqual(chamfer.bridge.points, [
    { x: 20, y: 0 },
    { x: 0, y: 20 },
  ]);
  const sharp = cornerLines(a, b, { x: 90, y: 0 }, { x: 0, y: 90 }, 0, true);
  assert.equal(sharp.bridge, null);
  assert.throws(() =>
    cornerLines(a, b, { x: 90, y: 0 }, { x: 0, y: 90 }, 101, true),
  );
});

test("joining duplicate reversed segments does not create invalid closed contour", () => {
  assert.throws(() =>
    joinEntities([a, { ...a, id: "b", points: [...a.points].reverse() }]),
  );
});

test("polylines export all edges as vector strokes", async () => {
  const { PDFDocument, PDFRawStream, decodePDFRawStream } =
    await import("pdf-lib");
  const { exportPdf } = await import("../src/export.js");
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const e = transformEntity(
    {
      ...a,
      type: "rect",
      viewportId: undefined,
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
      ],
    },
    "rotate",
    { x: 100, y: 100 },
    { x: 200, y: 200 },
  );
  const source = {
    getPage: async () => ({
      rotate: 0,
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 800 - y] }),
    }),
  };
  const result = await PDFDocument.load(
    await exportPdf(await doc.save(), [e], {}, source),
  );
  const content = result
    .getPage(0)
    .node.Contents()
    .asArray()
    .map((ref) =>
      Buffer.from(
        decodePDFRawStream(result.context.lookup(ref, PDFRawStream)).decode(),
      ).toString("latin1"),
    )
    .join("");
  assert.equal(content.split("\n").filter((x) => x === "S").length, 4);
});
