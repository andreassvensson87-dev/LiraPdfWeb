import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, degrees } from "pdf-lib";
import { pageRotation, normalizeRotation } from "../src/page-rotation.js";
import { exportPdf } from "../src/export.js";
import { validateProject } from "../src/core.js";
test("quarter turns preserve exact pointer coordinates and swap page extent", () => {
  for (const angle of [0, 90, 180, 270]) {
    const r = pageRotation(200, 300, angle);
    for (const p of [
      { x: 0, y: 0 },
      { x: 200, y: 300 },
      { x: 72, y: 165 },
      { x: -20, y: 400 },
    ])
      assert.deepEqual(r.inverse(r.forward(p)), p);
    assert.equal(r.width, angle % 180 ? 300 : 200);
  }
  assert.deepEqual(pageRotation(200, 300, 90).forward({ x: 20, y: 30 }), {
    x: 270,
    y: 20,
  });
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
});
test("export rotates only selected page, adds to original orientation, retains marks", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]).setRotation(degrees(90));
  doc.addPage([200, 300]);
  const bytes = await doc.save();
  const pdf = {
    getPage: async () => ({
      rotate: 90,
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, y] }),
    }),
  };
  const entity = {
    id: "line",
    page: 1,
    type: "line",
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
    color: "#147b60",
    width: 1,
    fontSize: 12,
  };
  const output = await PDFDocument.load(
    await exportPdf(bytes, [entity], {}, pdf, { 1: 270 }),
  );
  assert.equal(output.getPage(0).getRotation().angle, 0);
  assert.equal(output.getPage(1).getRotation().angle, 0);
  assert.ok(output.getPage(0).node.Contents());
  assert.equal(
    (await PDFDocument.load(bytes)).getPage(0).getRotation().angle,
    90,
  );
});
test("project rotations round-trip and invalid values fail validation", () => {
  const p = {
    format: "lirapdf",
    version: 1,
    pdf: "test",
    entities: [],
    scales: {},
    rotations: { 1: 90, 2: 270 },
  };
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(p))).rotations,
    p.rotations,
  );
  for (const rotations of [{ 1: 45 }, { 1: -90 }, { x: 90 }, [], null])
    assert.throws(() => validateProject({ ...p, rotations }));
});
