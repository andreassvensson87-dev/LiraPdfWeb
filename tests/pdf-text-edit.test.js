import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  removableTexts,
  textRemovalTargets,
  textTargetAt,
} from "../src/pdf-text-edit.js";
import {
  pageContent,
  removableLines,
  applyLineRemovals,
} from "../src/pdf-line-edit.js";
import { validateProject } from "../src/core.js";
import { exportPdf } from "../src/export.js";
async function fixture() {
  const doc = await PDFDocument.create(),
    page = doc.addPage([300, 300]);
  page.drawText("Remove me", { x: 20, y: 100, size: 12 });
  page.drawText("Keep me", { x: 20, y: 150, size: 12 });
  page.drawLine({ start: { x: 20, y: 50 }, end: { x: 100, y: 50 } });
  const bytes = await doc.save(),
    loaded = await PDFDocument.load(bytes);
  return { bytes, doc: loaded, page: loaded.getPage(0) };
}
const viewport = {
  transform: [1, 0, 0, -1, 0, 300],
  convertToPdfPoint: (x, y) => [x, 300 - y],
};
test("text removal changes content, keeps surrounding text and vectors, and combines with line removal", async () => {
  const { bytes, doc, page } = await fixture(),
    content = pageContent(doc, page);
  const texts = removableTexts(content, doc, page);
  assert.deepEqual(
    texts.map((t) => t.text),
    ["Remove me", "Keep me"],
  );
  const edit = {
    id: "erase",
    type: "pdfErase",
    page: 1,
    eraseTextOffset: texts[0].offset,
    points: [
      { x: 20, y: 200 },
      { x: 90, y: 188 },
    ],
    color: "#000000",
    width: 1,
    fontSize: 12,
  };
  const project = {
    format: "lirapdf",
    version: 1,
    pdf: "fixture",
    entities: [edit],
    scales: {},
  };
  assert.doesNotThrow(() => validateProject(project));
  assert.throws(() =>
    validateProject({ ...project, entities: [{ ...edit, eraseOffset: 2 }] }),
  );
  const edited = await PDFDocument.load(await applyLineRemovals(bytes, [edit]));
  const result = pageContent(edited, edited.getPage(0));
  assert.deepEqual(
    removableTexts(result, edited, edited.getPage(0)).map((t) => t.text),
    ["Keep me"],
  );
  assert.equal(removableLines(result).length, 1);
  assert.ok(!result.includes("52656D6F7665206D65"));
  const line = removableLines(content)[0];
  const both = await PDFDocument.load(
    await applyLineRemovals(bytes, [
      edit,
      { type: "pdfErase", page: 1, eraseOffset: line.offset },
    ]),
  );
  assert.equal(removableLines(pageContent(both, both.getPage(0))).length, 0);
  assert.deepEqual(await applyLineRemovals(bytes, []), bytes);
  await assert.rejects(
    applyLineRemovals(bytes, [{ ...edit, eraseTextOffset: 2 }]),
  );
  const output = await exportPdf(
    bytes,
    [edit],
    {},
    { getPage: async () => ({ getViewport: () => viewport }) },
  );
  const exported = await PDFDocument.load(output);
  assert.deepEqual(
    removableTexts(
      pageContent(exported, exported.getPage(0)),
      exported,
      exported.getPage(0),
    ).map((t) => t.text),
    ["Keep me"],
  );
  assert.deepEqual(
    removableTexts(pageContent(doc, page), doc, page).map((t) => t.text),
    ["Remove me", "Keep me"],
  );
});
test("only unambiguous text is highlighted, including rotated hit testing", async () => {
  const { bytes } = await fixture();
  const item = {
    str: "Remove me",
    transform: [12, 0, 0, 12, 20, 100],
    width: 60,
    height: 12,
  };
  const targets = await textRemovalTargets(bytes, 1, [item], viewport);
  assert.equal(targets.length, 1);
  assert.equal(textTargetAt(targets, { x: 40, y: 195 })?.text, "Remove me");
  assert.equal(textTargetAt(targets, { x: 40, y: 160 }), undefined);
  assert.equal(
    (await textRemovalTargets(bytes, 1, [item, item], viewport)).length,
    0,
  );
  assert.equal(
    (await textRemovalTargets(bytes, 1, [{ ...item, str: "Remove" }], viewport))
      .length,
    0,
  );
  const rotated = { transform: [0, 1, 1, 0, 0, 0] };
  const rt = await textRemovalTargets(bytes, 1, [item], rotated);
  assert.equal(textTargetAt(rt, { x: 105, y: 40 })?.text, "Remove me");
});
test("compound text, clipping and marked content are left untouched", async () => {
  const { doc, page } = await fixture(),
    content = pageContent(doc, page);
  for (const variant of [
    content.replace("Tj", "Tj (extra) Tj"),
    content.replace("BT", "BT 0 -12 Td"),
    content.replace("BT", "BT 7 Tr"),
    "/Span BMC " + content + " EMC",
  ]) {
    assert.ok(removableTexts(variant, doc, page).length < 2);
  }
});
