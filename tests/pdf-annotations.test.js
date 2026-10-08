import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFString,
  PDFNumber,
  degrees,
  decodePDFRawStream,
} from "pdf-lib";
import { readEditablePdf, saveEditablePdf } from "../src/editable-pdf.js";
import { annotationCoordinates } from "../src/pdf-annotations.js";
const k = PDFName.of;
const entity = (type, id = type) => ({
  id,
  type,
  page: 1,
  points: [
    { x: 20, y: 30 },
    { x: 80, y: 90 },
  ],
  color: "#238855",
  width: 2,
  fontSize: 12,
  ...(type === "polyline" ? { closed: false } : {}),
});
const viewer = (doc) => ({
  getPage: async (n) => ({
    getViewport: () => {
      const page = doc.getPage(n - 1),
        mapping = annotationCoordinates(page);
      const o = mapping.fromPdf(0, 0),
        x = mapping.fromPdf(1, 0),
        y = mapping.fromPdf(0, 1);
      const [a, b, c, d] = [x.x - o.x, x.y - o.y, y.x - o.x, y.y - o.y],
        det = a * d - b * c;
      return {
        convertToPdfPoint: (px, py) => [
          (d * (px - o.x) - c * (py - o.y)) / det,
          (-b * (px - o.x) + a * (py - o.y)) / det,
        ],
      };
    },
  }),
});
async function document() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  return doc;
}
function add(doc, data) {
  const annot = doc.context.obj({
    Type: "Annot",
    F: 4,
    Rect: [10, 20, 100, 120],
    C: [1, 0, 0],
    BS: { W: 2, S: "S" },
    ...data,
  });
  doc.getPage(0).node.addAnnot(doc.context.register(annot));
  return annot;
}
function annots(doc) {
  return doc
    .getPage(0)
    .node.Annots()
    .asArray()
    .map((ref) => doc.context.lookup(ref, PDFDict));
}

test("external Line, PolyLine, Polygon, Square and Ink import without baking or duplication", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "Line",
    NM: PDFString.of("external"),
    L: [10, 20, 100, 120],
    Contents: PDFString.of("Review comment"),
    T: PDFString.of("Reviewer"),
  });
  add(doc, { Subtype: "PolyLine", Vertices: [10, 20, 30, 40, 50, 60] });
  add(doc, { Subtype: "Polygon", Vertices: [10, 20, 30, 40, 50, 20] });
  add(doc, { Subtype: "Square", Rect: [10, 20, 100, 120], RD: [2, 2, 2, 2] });
  add(doc, { Subtype: "Ink", InkList: [[10, 20, 30, 40, 50, 60]] });
  const imported = await readEditablePdf(await doc.save());
  assert.deepEqual(
    imported.state.entities.map((e) => e.type),
    ["line", "polyline", "polyline", "rect", "freehand"],
  );
  assert.deepEqual(imported.state.entities[0].points, [
    { x: 10, y: 280 },
    { x: 100, y: 180 },
  ]);
  const source = await PDFDocument.load(imported.bytes);
  assert.equal(source.getPage(0).node.Annots(), undefined);
  imported.state.entities[0].points[0].x = 25;
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  assert.equal(annots(saved).length, 5);
  assert.deepEqual(
    annots(saved).map((a) => a.lookup(k("Subtype")).toString()),
    ["/Line", "/PolyLine", "/Polygon", "/Square", "/Ink"],
  );
  const line = annots(saved)[0];
  assert.equal(line.lookup(k("L")).lookup(0, PDFNumber).asNumber(), 25);
  assert.equal(line.lookup(k("Contents")).decodeText(), "Review comment");
  assert.equal(line.lookup(k("T")).decodeText(), "Reviewer");
  for (const annotation of annots(saved)) {
    const appearance = annotation.lookup(k("AP"), PDFDict).lookup(k("N"));
    assert.match(
      new TextDecoder().decode(decodePDFRawStream(appearance).decode()),
      /S Q/,
    );
  }
});

test("external edits, additions, deletions and page rotations override Lira cached annotation state", async () => {
  const source = await document(),
    bytes = await source.save();
  const state = {
    entities: [entity("line", "edited"), entity("rect", "deleted")],
    scales: { 1: 100 },
    rotations: {},
  };
  const doc = await PDFDocument.load(
    await saveEditablePdf(bytes, state, viewer(source)),
  );
  const refs = doc.getPage(0).node.Annots();
  refs.remove(1);
  const line = annots(doc)[0];
  line.set(k("L"), doc.context.obj([40, 50, 100, 150]));
  line.set(k("C"), doc.context.obj([0, 0, 1]));
  line.set(k("BS"), doc.context.obj({ W: 5, S: "S" }));
  add(doc, { Subtype: "Line", NM: PDFString.of("new"), L: [5, 10, 40, 50] });
  doc.getPage(0).setRotation(degrees(90));
  const imported = await readEditablePdf(await doc.save());
  assert.deepEqual(
    imported.state.entities.map((e) => e.id),
    ["edited", "new"],
  );
  assert.equal(imported.state.entities[0].color, "#0000ff");
  assert.equal(imported.state.entities[0].width, 5);
  assert.deepEqual(imported.state.entities[0].points, [
    { x: 40, y: 250 },
    { x: 100, y: 150 },
  ]);
  assert.deepEqual(imported.state.rotations, { 1: 90 });
  const base = await PDFDocument.load(imported.bytes);
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(base)),
  );
  assert.equal(annots(saved).length, 2);
  assert.equal(saved.getPage(0).getRotation().angle, 90);
});

test("unsupported, locked and measured annotations remain in the source and output unchanged", async () => {
  const doc = await document();
  add(doc, { Subtype: "Line", L: [10, 20, 100, 120] });
  add(doc, { Subtype: "FreeText", Contents: PDFString.of("Keep this note") });
  add(doc, {
    Subtype: "Line",
    L: [10, 20, 100, 120],
    Measure: { Type: "Measure", Subtype: "RL" },
  });
  add(doc, { Subtype: "Line", L: [10, 20, 100, 120], F: 128 });
  add(doc, {
    Subtype: "Ink",
    InkList: [
      [10, 20, 30, 40],
      [50, 60, 70, 80],
    ],
  });
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities.length, 1);
  const source = await PDFDocument.load(imported.bytes);
  assert.equal(annots(source).length, 4);
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  assert.equal(annots(saved).length, 5);
  assert.equal(
    annots(saved)[0].lookup(k("Contents")).decodeText(),
    "Keep this note",
  );
});

test("crop offsets, UserUnit and every right-angle page rotation round-trip geometric coordinates", async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const doc = await document(),
      page = doc.getPage(0);
    page.setMediaBox(-30, -50, 200, 300);
    page.setCropBox(-10, -20, 150, 220);
    page.setRotation(degrees(rotation));
    page.node.set(k("UserUnit"), PDFNumber.of(2));
    const state = {
      entities: ["line", "rect", "polyline", "freehand"].map((type) =>
        entity(type),
      ),
      scales: {},
    };
    const imported = await readEditablePdf(
      await saveEditablePdf(await doc.save(), state, viewer(doc)),
    );
    for (let i = 0; i < state.entities.length; i++) {
      const actual = imported.state.entities[i];
      assert.equal(actual.width, 2);
      assert.equal(actual.type, state.entities[i].type);
      if (actual.type === "rect") {
        assert.deepEqual(
          actual.points.map((p) => p.x).sort((a, b) => a - b),
          [20, 80],
        );
        assert.deepEqual(
          actual.points.map((p) => p.y).sort((a, b) => a - b),
          [30, 90],
        );
      } else assert.deepEqual(actual.points, state.entities[i].points);
    }
  }
});

test("old Lira v1 PDFs keep existing objects and also pick up new external annotations", async () => {
  const source = await document(),
    bytes = await source.save(),
    doc = await PDFDocument.load(bytes);
  const state = { entities: [entity("line", "old")], scales: {} };
  doc.catalog.set(
    k("LiraPDF"),
    doc.context.obj({
      Version: 1,
      Source: doc.context.register(doc.context.flateStream(bytes)),
      State: doc.context.register(
        doc.context.flateStream(JSON.stringify(state)),
      ),
    }),
  );
  add(doc, { Subtype: "Line", L: [10, 20, 100, 120] });
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities.length, 2);
  assert.equal(imported.state.entities[0].id, "old");
});

test("repeated save/open keeps one annotation, no nested Lira source and bounded size", async () => {
  let source = await document(),
    bytes = await source.save(),
    state = { entities: [entity("line")], scales: {} },
    previousSize;
  for (let i = 0; i < 8; i++) {
    const saved = await saveEditablePdf(bytes, state, viewer(source));
    const visible = await PDFDocument.load(saved);
    assert.equal(annots(visible).length, 1);
    if (i > 2)
      assert.ok(
        Math.abs(saved.length - previousSize) < 100,
        "PDF must not grow each time",
      );
    previousSize = saved.length;
    const imported = await readEditablePdf(saved);
    bytes = imported.bytes;
    state = imported.state;
    source = await PDFDocument.load(bytes);
    assert.equal(source.catalog.has(k("LiraPDF")), false);
    assert.equal(source.getPage(0).node.Annots(), undefined);
  }
});

test("standard objects remain editable even if another editor removes all private Lira metadata", async () => {
  const source = await document(),
    state = {
      entities: ["line", "rect", "polyline", "freehand"].map((type) =>
        entity(type),
      ),
      scales: {},
    };
  const doc = await PDFDocument.load(
    await saveEditablePdf(await source.save(), state, viewer(source)),
  );
  doc.catalog.delete(k("LiraPDF"));
  const imported = await readEditablePdf(await doc.save());
  assert.deepEqual(
    imported.state.entities.map((e) => e.type),
    ["line", "rect", "polyline", "freehand"],
  );
  assert.equal(
    (await PDFDocument.load(imported.bytes)).getPage(0).node.Annots(),
    undefined,
  );
});

test("popup and page references stay attached to existing pages across copying and saving", async () => {
  const doc = await document();
  const line = add(doc, {
    Subtype: "Line",
    NM: PDFString.of("with-popup"),
    L: [10, 20, 100, 120],
  });
  const page = doc.getPage(0),
    lineRef = page.node.Annots().get(0);
  line.set(k("P"), page.ref);
  const popup = doc.context.obj({
    Type: "Annot",
    Subtype: "Popup",
    Rect: [10, 20, 100, 120],
    Parent: lineRef,
    P: page.ref,
  });
  line.set(k("Popup"), doc.context.register(popup));
  page.node.addAnnot(line.get(k("Popup")));
  const imported = await readEditablePdf(await doc.save()),
    source = await PDFDocument.load(imported.bytes);
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  const savedLine = annots(saved).find(
    (a) => a.lookup(k("Subtype")).toString() === "/Line",
  );
  assert.equal(
    savedLine.get(k("P")).toString(),
    saved.getPage(0).ref.toString(),
  );
  assert.equal(
    savedLine.lookup(k("Popup"), PDFDict).get(k("P")).toString(),
    saved.getPage(0).ref.toString(),
  );
  const savedLineRef = saved
    .getPage(0)
    .node.Annots()
    .asArray()
    .find((ref) => saved.context.lookup(ref) === savedLine);
  assert.equal(
    savedLine.lookup(k("Popup"), PDFDict).get(k("Parent")).toString(),
    savedLineRef.toString(),
  );
  assert.equal(saved.getPageCount(), 1);
});

test("copying an imported entity creates separate PDF objects and stable identities", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "Line",
    NM: PDFString.of("original"),
    L: [10, 20, 100, 120],
  });
  const imported = await readEditablePdf(await doc.save());
  const copy = {
    ...structuredClone(imported.state.entities[0]),
    id: "copied",
    points: [
      { x: 50, y: 60 },
      { x: 80, y: 90 },
    ],
  };
  imported.state.entities.push(copy);
  const source = await PDFDocument.load(imported.bytes);
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  const marks = annots(saved);
  assert.notEqual(marks[0], marks[1]);
  assert.deepEqual(
    marks.map((a) => a.lookup(k("NM")).decodeText()),
    ["original", "copied"],
  );
  const again = await readEditablePdf(await saved.save());
  assert.deepEqual(again.state.entities[1].points, copy.points);
});

test("deleting an imported mark also removes its associated popup", async () => {
  const doc = await document(),
    line = add(doc, { Subtype: "Line", L: [10, 20, 100, 120] }),
    lineRef = doc.getPage(0).node.Annots().get(0);
  const popup = doc.context.register(
    doc.context.obj({
      Subtype: "Popup",
      Parent: lineRef,
      Rect: [0, 0, 100, 100],
    }),
  );
  line.set(k("Popup"), popup);
  doc.getPage(0).node.addAnnot(popup);
  const imported = await readEditablePdf(await doc.save()),
    source = await PDFDocument.load(imported.bytes);
  assert.equal(source.getPage(0).node.Annots(), undefined);
  imported.state.entities = [];
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  assert.equal(saved.getPage(0).node.Annots(), undefined);
});
