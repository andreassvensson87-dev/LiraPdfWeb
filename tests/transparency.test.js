import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { validateProject } from "../src/core.js";
import { exportPdf } from "../src/export.js";

const base = { id: "a", page: 1, color: "#147b60", width: 5, fontSize: 12 };
const points = [
  { x: 20, y: 20 },
  { x: 60, y: 50 },
  { x: 80, y: 20 },
];
const project = (entity) => ({
  format: "lirapdf",
  version: 1,
  pdf: "",
  scales: {},
  entities: [entity],
});
const source = {
  getPage: async () => ({
    rotate: 0,
    getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 300 - y] }),
  }),
};

test("old projects remain opaque by default; opacity round-trips and invalid values fail", () => {
  const entity = { ...base, type: "line", points: points.slice(0, 2) };
  validateProject(project(entity));
  for (const opacity of [0, 0.35, 1]) {
    const saved = JSON.parse(JSON.stringify(project({ ...entity, opacity })));
    validateProject(saved);
    assert.equal(saved.entities[0].opacity, opacity);
  }
  for (const opacity of [-0.1, 1.1, NaN, Infinity, "0.5", null])
    assert.throws(() => validateProject(project({ ...entity, opacity })));
});

for (const type of [
  "line",
  "freehand",
  "polyline",
  "rect",
  "circle",
  "arc",
  "leader",
  "text",
  "mask",
  "replace",
  "dim",
  "viewport",
  "block",
]) {
  test(`${type} exports transparency once for the complete object`, async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    const entity = {
      ...base,
      type,
      opacity: 0.35,
      points: [
        "line",
        "rect",
        "circle",
        "mask",
        "replace",
        "viewport",
      ].includes(type)
        ? points.slice(0, 2)
        : type === "text" || type === "block"
          ? points.slice(0, 1)
          : points,
      text: "Granskat",
      closed: false,
      denominator: 100,
      showLabel: true,
      name: "Vy",
    };
    if (type === "block") {
      const block = await PDFDocument.create();
      block.addPage([100, 100]).drawText("Block", { x: 10, y: 10 });
      Object.assign(entity, {
        blockPdf: Buffer.from(await block.save()).toString("base64"),
        blockWidth: 100,
        blockHeight: 100,
        rotation: 0,
      });
    }
    const exported = await PDFDocument.load(
      await exportPdf(await doc.save(), [entity], {}, source),
    );
    assert.equal(exported.getPageCount(), 1);
    const resources = exported.getPage(0).node.Resources();
    const states = resources.lookup(PDFName.of("ExtGState"), PDFDict).entries();
    assert.equal(states.length, 1);
    const state = exported.context.lookup(states[0][1]);
    assert.equal(state.lookup(PDFName.of("ca")).asNumber(), 0.35);
    const forms = resources.lookup(PDFName.of("XObject"), PDFDict).entries();
    assert.equal(forms.length, 1);
    const group = exported.context
      .lookup(forms[0][1])
      .dict.lookup(PDFName.of("Group"), PDFDict);
    assert.equal(group.lookup(PDFName.of("S")).toString(), "/Transparency");
    assert.equal(group.lookup(PDFName.of("I")).asBoolean(), true);
  });
}

test("fully transparent objects add no visible content or extra pages", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  const exported = await PDFDocument.load(
    await exportPdf(
      await doc.save(),
      [{ ...base, type: "line", points: points.slice(0, 2), opacity: 0 }],
      {},
      source,
    ),
  );
  assert.equal(exported.getPageCount(), 1);
  const contents = exported.getPage(0).node.Contents();
  assert.ok(!contents || contents.size() === 0);
});
