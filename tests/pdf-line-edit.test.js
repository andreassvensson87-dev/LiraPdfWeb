import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  removableLines,
  applyLineRemovals,
  findRemovableLine,
} from "../src/pdf-line-edit.js";
test("only standalone strokes can be removed, with graphics transforms and string safety", () => {
  const s =
    "q 2 0 0 2 10 20 cm 0 0 m 30 0 l S Q (0 0 m 1 1 l S) Tj 0 0 m 5 5 l 10 10 l S 1 1 3 4 re S 0 0 m 3 4 l W S";
  const lines = removableLines(s);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].a, { x: 10, y: 20 });
  assert.deepEqual(lines[0].b, { x: 70, y: 20 });
  assert.equal(removableLines("0 0 m 1 1 l f").length, 0);
  assert.equal(removableLines("BI xx ID bytes EI 0 0 m 1 1 l S").length, 0);
});
test("actual content removal retains other vectors and text and validates offsets", async () => {
  const doc = await PDFDocument.create(),
    page = doc.addPage([200, 300]);
  page.drawLine({ start: { x: 10, y: 20 }, end: { x: 100, y: 20 } });
  page.drawText("Keep me", { x: 10, y: 40 });
  const bytes = await doc.save();
  const vp = { convertToViewportPoint: (x, y) => [x, 300 - y] };
  const line = await findRemovableLine(
    bytes,
    1,
    { a: { x: 10, y: 280 }, b: { x: 100, y: 280 } },
    vp,
  );
  assert.ok(line);
  const edited = await PDFDocument.load(
    await applyLineRemovals(bytes, [
      { type: "pdfErase", page: 1, eraseOffset: line.offset },
    ]),
  );
  const stream = edited.context.lookup(
    edited.getPage(0).node.Contents(),
    PDFRawStream,
  );
  const content = Buffer.from(decodePDFRawStream(stream).decode()).toString(
    "latin1",
  );
  assert.equal(removableLines(content).length, 0);
  assert.ok(content.includes("4B656570206D65"));
  await assert.rejects(
    applyLineRemovals(bytes, [{ type: "pdfErase", page: 1, eraseOffset: 1 }]),
    /säkert/,
  );
  assert.equal(
    (
      await findRemovableLine(
        bytes,
        1,
        { a: { x: 10, y: 280 }, b: { x: 100, y: 280 } },
        vp,
      )
    ).offset,
    line.offset,
  );
});
