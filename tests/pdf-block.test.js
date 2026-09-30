import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  degrees,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { blockPage, blockCorners } from "../src/pdf-block.js";
import { exportPdf } from "../src/export.js";
import { validateProject } from "../src/core.js";
for (const rotation of [0, 90, 180, 270])
  test(`block keeps crop box and normalizes rotation ${rotation}`, async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const page = doc.addPage([300, 200]);
    page.drawText("BLOCK", { x: 35, y: 65 });
    page.setCropBox(30, 40, 180, 100);
    page.setRotation(degrees(rotation));
    const block = await blockPage(await doc.save(), 2),
      result = await PDFDocument.load(block.bytes);
    assert.equal(result.getPageCount(), 1);
    assert.equal(result.getPage(0).getRotation().angle, 0);
    assert.deepEqual(
      result.getPage(0).getSize(),
      rotation % 180
        ? { width: 100, height: 180 }
        : { width: 180, height: 100 },
    );
    const xobjects = result
      .getPage(0)
      .node.Resources()
      .lookup(PDFName.of("XObject"));
    assert.equal(xobjects.keys().length, 1);
    const form = xobjects.lookup(xobjects.keys()[0], PDFRawStream);
    assert.equal(form.dict.lookup(PDFName.of("Subtype")).toString(), "/Form");
    assert.match(
      Buffer.from(decodePDFRawStream(form).decode()).toString(),
      /424C4F434B/,
    );
    await assert.rejects(blockPage(await doc.save(), 3), /sidnummer/);
  });
test("block geometry, project roundtrip and vector export", async () => {
  const stamp = await PDFDocument.create();
  stamp.addPage([120, 60]).drawText("STAMP");
  const block = await blockPage(await stamp.save(), 1);
  const e = {
    id: "block",
    page: 1,
    type: "block",
    points: [{ x: 40, y: 50 }],
    blockPdf: Buffer.from(block.bytes).toString("base64"),
    preview: "data:image/png;base64,AAAA",
    naturalWidth: 120,
    naturalHeight: 60,
    blockWidth: 60,
    blockHeight: 30,
    rotation: 90,
    color: "#000000",
    width: 1,
    fontSize: 12,
  };
  const corners = blockCorners(e);
  assert.ok(Math.abs(corners[2].x - 10) < 1e-8);
  assert.equal(corners[2].y, 110);
  const project = {
    format: "lirapdf",
    version: 1,
    pdf: "AA==",
    entities: [e],
    scales: {},
  };
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(project))),
    project,
  );
  assert.throws(
    () => validateProject({ ...project, entities: [{ ...e, blockWidth: 0 }] }),
    /PDF-block/,
  );
  const target = await PDFDocument.create();
  target.addPage([400, 300]);
  const source = {
    getPage: async () => ({
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 300 - y] }),
    }),
  };
  const out = await PDFDocument.load(
    await exportPdf(
      await target.save(),
      [e, { ...e, id: "copy", points: [{ x: 200, y: 50 }] }],
      {},
      source,
    ),
  );
  const resources = out
    .getPage(0)
    .node.Resources()
    .lookup(PDFName.of("XObject"));
  for (const key of resources.keys())
    assert.equal(
      resources
        .lookup(key, PDFRawStream)
        .dict.lookup(PDFName.of("Subtype"))
        .toString(),
      "/Form",
    );
});
