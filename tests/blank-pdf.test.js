import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { blankPdf, paperSizes } from "../src/blank-pdf.js";
test("blank paper supports A0–A4 in both orientations without page content", async () => {
  for (const [size, mm] of Object.entries(paperSizes))
    for (const landscape of [true, false]) {
      const doc = await PDFDocument.load(await blankPdf(size, landscape));
      assert.equal(doc.getPageCount(), 1);
      const page = doc.getPage(0),
        dimensions = landscape ? [...mm].reverse() : mm;
      assert.ok(Math.abs((page.getWidth() * 25.4) / 72 - dimensions[0]) < 1e-8);
      assert.ok(
        Math.abs((page.getHeight() * 25.4) / 72 - dimensions[1]) < 1e-8,
      );
      assert.equal(page.node.Contents(), undefined);
    }
  await assert.rejects(blankPdf("invalid"));
});
