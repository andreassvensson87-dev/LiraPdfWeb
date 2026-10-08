import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName } from "pdf-lib";
import { readEditablePdf, saveEditablePdf } from "../src/editable-pdf.js";

const viewer = {
  getPage: async () => ({
    rotate: 0,
    getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 300 - y] }),
  }),
};
const line = {
  id: "line",
  page: 1,
  type: "line",
  points: [
    { x: 20, y: 30 },
    { x: 150, y: 80 },
  ],
  color: "#008855",
  width: 2,
  fontSize: 12,
  groupId: "group",
};
async function originalPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  doc.addPage([200, 300]);
  return doc.save();
}

test("a saved PDF shows marks in ordinary readers and restores original PDF, groups, scales and rotations", async () => {
  const bytes = await originalPdf();
  const state = {
    entities: [
      line,
      {
        ...line,
        id: "second",
        points: [
          { x: 30, y: 40 },
          { x: 100, y: 70 },
        ],
      },
    ],
    scales: { 1: 100 },
    rotations: { 2: 90 },
  };
  const result = await saveEditablePdf(bytes, state, viewer);
  const visible = await PDFDocument.load(result);
  assert.equal(visible.getPageCount(), 2);
  assert.equal(visible.getPage(0).node.Annots().size(), 2);
  assert.equal(visible.getPage(1).getRotation().angle, 90);
  const restored = await readEditablePdf(result);
  assert.equal(
    (await PDFDocument.load(restored.bytes)).getPage(0).node.Annots(),
    undefined,
  );
  assert.deepEqual(restored.state.scales, state.scales);
  assert.deepEqual(restored.state.rotations, state.rotations);
  assert.deepEqual(
    restored.state.entities.map((e) => ({
      ...e,
      opacity: undefined,
      pdfAnnotationId: undefined,
    })),
    state.entities.map((e) => ({
      ...e,
      opacity: undefined,
      pdfAnnotationId: undefined,
    })),
  );
});

test("saving reopened PDFs repeatedly does not duplicate marks or nest prior saved PDFs", async () => {
  const bytes = await originalPdf();
  const state = { entities: [line], scales: {} };
  const first = await saveEditablePdf(bytes, state, viewer);
  const reopened = await readEditablePdf(first);
  const second = await saveEditablePdf(reopened.bytes, reopened.state, viewer);
  const again = await readEditablePdf(second);
  assert.equal(
    (await PDFDocument.load(again.bytes)).catalog.has(PDFName.of("LiraPDF")),
    false,
  );
  assert.equal(
    (await PDFDocument.load(again.bytes)).getPage(0).node.Annots(),
    undefined,
  );
  assert.equal(again.state.entities.length, 1);
  const clean = await saveEditablePdf(
    again.bytes,
    { entities: [], scales: {} },
    viewer,
  );
  assert.equal((await readEditablePdf(clean)).state.entities.length, 0);
});

test("plain PDFs have no editing data; unsupported embedded versions fail instead of dropping edits", async () => {
  const bytes = await originalPdf();
  assert.equal(await readEditablePdf(bytes), null);
  const doc = await PDFDocument.load(bytes);
  doc.catalog.set(PDFName.of("LiraPDF"), doc.context.obj({ Version: 99 }));
  await assert.rejects(readEditablePdf(await doc.save()), /version/);
});
