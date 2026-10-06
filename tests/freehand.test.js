import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { appendStrokePoint, completeStroke } from "../src/freehand.js";
import { primitives, validateProject } from "../src/core.js";
import { translateEntity } from "../src/editing.js";
import { inSelection } from "../src/selection.js";
import { exportPdf } from "../src/export.js";

const stroke = () => ({
  id: "stroke",
  type: "freehand",
  page: 2,
  color: "#147b60",
  width: 5,
  fontSize: 12,
  points: [
    { x: 20, y: 30 },
    { x: 50, y: 70 },
    { x: 90, y: 40 },
  ],
});
test("release during movement retains the release position even without a final move", () => {
  const points = [{ x: 10, y: 20 }];
  assert.equal(completeStroke(points, { x: 80, y: 90 }), true);
  assert.deepEqual(points, [
    { x: 10, y: 20 },
    { x: 80, y: 90 },
  ]);
  completeStroke(points, { x: 80, y: 90 });
  assert.equal(points.length, 2);
});
test("capture loss preserves the sampled stroke without inventing an endpoint", () => {
  const points = structuredClone(stroke().points);
  const before = structuredClone(points);
  assert.equal(completeStroke(points, null), true);
  assert.deepEqual(points, before);
  assert.equal(completeStroke([{ x: 10, y: 20 }], null), false);
});
test("freehand survives project roundtrip, selection and movement as one object", () => {
  const e = stroke();
  const project = JSON.parse(
    JSON.stringify({
      format: "lirapdf",
      version: 1,
      pdf: "",
      entities: [e],
      scales: {},
    }),
  );
  validateProject(project);
  assert.equal(primitives(e, 1).length, 2);
  assert.ok(inSelection(e, { x: 0, y: 0 }, { x: 100, y: 100 }));
  assert.ok(inSelection(e, { x: 45, y: 60 }, { x: 30, y: 40 }));
  const moved = translateEntity(e, { x: 0, y: 0 }, { x: 10, y: -5 });
  assert.deepEqual(moved.points[0], { x: 30, y: 25 });
  assert.deepEqual(e.points[0], { x: 20, y: 30 });
  assert.throws(() =>
    validateProject({
      format: "lirapdf",
      version: 1,
      pdf: "",
      entities: [{ ...e, points: [e.points[0]] }],
      scales: {},
    }),
  );
});
test("long strokes stay within project point limit and retain first and final points", () => {
  const points = [{ x: 0, y: 0 }];
  appendStrokePoint(points, { x: 0.1, y: 0 }, 0.5);
  assert.equal(points.length, 1);
  for (let x = 1; x <= 25000; x++) appendStrokePoint(points, { x, y: x % 100 });
  assert.ok(points.length <= 10000);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points.at(-1), { x: 25000, y: 0 });
  validateProject({
    format: "lirapdf",
    version: 1,
    pdf: "",
    entities: [{ ...stroke(), points }],
    scales: {},
  });
});
test("freehand exports vector strokes with chosen width and round caps only on its page", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  doc.addPage([200, 300]);
  const source = {
    getPage: async () => ({
      rotate: 0,
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 300 - y] }),
    }),
  };
  const exported = await PDFDocument.load(
    await exportPdf(await doc.save(), [stroke()], {}, source),
  );
  const streams = exported.getPage(1).node.Contents();
  const content = Array.from({ length: streams.size() }, (_, i) =>
    Buffer.from(
      decodePDFRawStream(
        exported.context.lookup(streams.get(i), PDFRawStream),
      ).decode(),
    ).toString(),
  ).join("");
  assert.ok(content.includes("5 w"));
  assert.ok(content.includes("1 J"));
  assert.ok(content.includes("20 270 m"));
  assert.ok(content.includes("50 230 l"));
  assert.equal((content.match(/\nS\n/g) || []).length, 2);
  const first = exported.getPage(0).node.Contents();
  assert.ok(!first || first.size() === 0);
});
