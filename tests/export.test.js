import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  degrees,
  decodePDFRawStream,
  PDFArray,
  PDFRawStream,
} from "pdf-lib";
import { exportPdf } from "../src/export.js";
const entity = {
  id: "a",
  page: 1,
  type: "text",
  points: [{ x: 20, y: 30 }],
  text: "Kontrollera dörrmått",
  fontSize: 12,
  width: 1,
  color: "#147b60",
};
for (const rotation of [0, 90, 180, 270])
  test(`export preserves page rotation ${rotation} and maps text baseline`, async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    page.setRotation(degrees(rotation));
    const maps = {
      0: (x, y) => [x, 300 - y],
      90: (x, y) => [y, x],
      180: (x, y) => [200 - x, y],
      270: (x, y) => [200 - y, 300 - x],
    };
    const pdf = {
      getPage: async () => ({
        rotate: rotation,
        getViewport: () => ({ convertToPdfPoint: maps[rotation] }),
      }),
    };
    const data = await exportPdf(await doc.save(), [entity], {}, pdf);
    const loaded = await PDFDocument.load(data);
    assert.equal(loaded.getPageCount(), 1);
    assert.equal(loaded.getPage(0).getRotation().angle, rotation);
    const streams = loaded.getPage(0).node.Contents();
    assert.ok(streams instanceof PDFArray);
    const content = Array.from({ length: streams.size() }, (_, i) =>
      Buffer.from(
        decodePDFRawStream(
          loaded.context.lookup(streams.get(i), PDFRawStream),
        ).decode(),
      ).toString(),
    ).join("");
    const [x, y] = maps[rotation](20, 30);
    assert.ok(content.includes(`${x} ${y} Tm`), content);
    assert.ok(content.includes("4B6F6E74726F6C6C6572612064F672726DE57474"));
  });

test("mask exports on its own page while retaining original text", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  const original = doc.addPage([200, 300]);
  original.drawText("Original", { x: 20, y: 270, size: 12 });
  const mask = {
    id: "mask",
    type: "mask",
    page: 2,
    points: [
      { x: 10, y: 10 },
      { x: 100, y: 50 },
    ],
    color: "#ffffff",
    fontSize: 12,
    width: 1,
  };
  const source = {
    getPage: async () => ({
      rotate: 0,
      getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 300 - y] }),
    }),
  };
  const loaded = await PDFDocument.load(
    await exportPdf(await doc.save(), [mask], {}, source),
  );
  assert.equal(loaded.getPageCount(), 2);
  const streams = loaded.getPage(1).node.Contents();
  const content = Array.from({ length: streams.size() }, (_, i) =>
    Buffer.from(
      decodePDFRawStream(
        loaded.context.lookup(streams.get(i), PDFRawStream),
      ).decode(),
    ).toString(),
  ).join("");
  assert.ok(content.includes("4F726967696E616C"));
  assert.ok(content.includes("1 1 1 rg"));
  assert.ok(content.includes("10 250 cm"));
});
