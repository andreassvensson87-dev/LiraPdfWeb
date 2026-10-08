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

test("Circle annotations import as editable circles and save as native circles with valid appearances", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "Circle",
    NM: PDFString.of("circle"),
    Rect: [20, 40, 100, 120],
    RD: [2, 2, 2, 2],
    IC: [],
  });
  const imported = await readEditablePdf(await doc.save());
  const circle = imported.state.entities[0];
  assert.equal(circle.type, "circle");
  assert.deepEqual(circle.points, [
    { x: 60, y: 220 },
    { x: 98, y: 220 },
  ]);
  circle.points = circle.points.map((p) => ({ x: p.x + 15, y: p.y - 20 }));
  const source = await PDFDocument.load(imported.bytes),
    saved = await PDFDocument.load(
      await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
    );
  const a = annots(saved)[0];
  assert.equal(a.lookup(k("Subtype")).toString(), "/Circle");
  const appearance = new TextDecoder().decode(
    decodePDFRawStream(a.lookup(k("AP"), PDFDict).lookup(k("N"))).decode(),
  );
  assert.equal((appearance.match(/ c\n/g) || []).length, 4);
  const reopened = await readEditablePdf(await saved.save());
  assert.deepEqual(reopened.state.entities[0].points, circle.points);
});

test("Polygon annotations with empty or solid interior colors remain editable and preserve fill through external changes", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "Polygon",
    NM: PDFString.of("empty-fill"),
    Vertices: [10, 20, 30, 40, 50, 20],
    IC: [],
  });
  add(doc, {
    Subtype: "Polygon",
    NM: PDFString.of("solid-fill"),
    Vertices: [60, 20, 80, 40, 100, 20],
    IC: [0, 1, 0],
    CA: 0.5,
  });
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities.length, 2);
  assert.equal(imported.state.entities[0].fillColor, undefined);
  assert.equal(imported.state.entities[0].closed, true);
  assert.equal(imported.state.entities[1].fillColor, "#00ff00");
  assert.equal(imported.state.entities[1].opacity, 0.5);
  const source = await PDFDocument.load(imported.bytes),
    saved = await PDFDocument.load(
      await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
    );
  const marks = annots(saved);
  assert.equal(marks[0].has(k("IC")), false);
  assert.deepEqual(
    marks[1]
      .lookup(k("IC"))
      .asArray()
      .map((n) => n.asNumber()),
    [0, 1, 0],
  );
  const appearance = new TextDecoder().decode(
    decodePDFRawStream(
      marks[1].lookup(k("AP"), PDFDict).lookup(k("N")),
    ).decode(),
  );
  assert.match(appearance, /0 1 0 rg/);
  assert.match(appearance, /B Q/);
  marks[1].set(k("IC"), saved.context.obj([]));
  const reopened = await readEditablePdf(await saved.save());
  assert.equal(reopened.state.entities[1].fillColor, undefined);
});

test("circle geometry round-trips with cropped, rotated and scaled pages", async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const doc = await document(),
      page = doc.getPage(0);
    page.setCropBox(10, 20, 150, 220);
    page.setRotation(degrees(rotation));
    page.node.set(k("UserUnit"), PDFNumber.of(2));
    const circle = {
      ...entity("circle"),
      points: [
        { x: 100, y: 110 },
        { x: 130, y: 150 },
      ],
      fillColor: "#ffee00",
    };
    const imported = await readEditablePdf(
      await saveEditablePdf(
        await doc.save(),
        { entities: [circle], scales: {} },
        viewer(doc),
      ),
    );
    const result = imported.state.entities[0];
    assert.equal(result.type, "circle");
    assert.equal(result.fillColor, "#ffee00");
    assert.deepEqual(result.points[0], circle.points[0]);
    assert.ok(
      Math.abs(
        Math.hypot(
          result.points[1].x - result.points[0].x,
          result.points[1].y - result.points[0].y,
        ) - 50,
      ) < 1e-7,
    );
  }
});

test("v2 saved Lira circles migrate without disappearing or creating duplicate shapes", async () => {
  const source = await document(),
    bytes = await source.save(),
    doc = await PDFDocument.load(bytes),
    circle = entity("circle", "old-circle");
  const state = { entities: [circle], scales: {} };
  doc.catalog.set(
    k("LiraPDF"),
    doc.context.obj({
      Version: 2,
      Source: doc.context.register(doc.context.flateStream(bytes)),
      State: doc.context.register(
        doc.context.flateStream(JSON.stringify(state)),
      ),
    }),
  );
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities.length, 1);
  assert.equal(imported.state.entities[0].id, "old-circle");
  const saved = await PDFDocument.load(
    await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
  );
  assert.equal(annots(saved).length, 1);
  assert.equal(annots(saved)[0].lookup(k("Subtype")).toString(), "/Circle");
  assert.equal(
    (await readEditablePdf(await saved.save())).state.entities.length,
    1,
  );
});

test("ovals import as ellipses while measured polygons retain their measurement semantics", async () => {
  const doc = await document();
  add(doc, { Subtype: "Circle", Rect: [10, 20, 110, 70] });
  add(doc, {
    Subtype: "Polygon",
    Vertices: [10, 20, 30, 40, 50, 20],
    IC: [],
    Measure: { Type: "Measure", Subtype: "RL" },
  });
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities.length, 1);
  assert.equal(imported.state.entities[0].type, "ellipse");
  assert.equal(
    (await PDFDocument.load(imported.bytes)).getPage(0).node.Annots().size(),
    1,
  );
});

test("Bluebeam open polylines with IC and no border dictionary import without being filled or closed", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "PolyLine",
    NM: PDFString.of("bluebeam-path"),
    Vertices: [
      1072.275, 354.5907, 1242.097, 482.9724, 1420.856, 391.1552, 1286.502,
      300.1504, 1072.275, 300.1504,
    ],
    IC: [1, 0, 0],
  });
  const original = annots(doc)[0];
  original.delete(k("BS"));
  const imported = await readEditablePdf(await doc.save()),
    polyline = imported.state.entities[0];
  assert.equal(polyline.type, "polyline");
  assert.equal(polyline.points.length, 5);
  assert.equal(polyline.closed, false);
  assert.equal(polyline.fillColor, undefined);
  assert.equal(polyline.width, 1);
  const source = await PDFDocument.load(imported.bytes),
    saved = await PDFDocument.load(
      await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
    );
  assert.equal(annots(saved)[0].lookup(k("Subtype")).toString(), "/PolyLine");
  const ap = new TextDecoder().decode(
    decodePDFRawStream(
      annots(saved)[0].lookup(k("AP"), PDFDict).lookup(k("N")),
    ).decode(),
  );
  assert.match(ap, /S Q/);
  assert.doesNotMatch(ap, /B Q|h\n/);
  assert.deepEqual(
    (await readEditablePdf(await saved.save())).state.entities[0].points,
    polyline.points,
  );
});

test("Bluebeam near-circles keep both ellipse axes through move, resizing, saving and reopening", async () => {
  const doc = await document();
  add(doc, {
    Subtype: "Circle",
    NM: PDFString.of("bluebeam-ellipse"),
    Rect: [1595.052, 241.1473, 1712.246, 355.0907],
    RD: [0.5, 0.5, 0.5, 0.5],
  });
  const imported = await readEditablePdf(await doc.save()),
    ellipse = imported.state.entities[0];
  assert.equal(ellipse.type, "ellipse");
  const before = structuredClone(ellipse.points);
  ellipse.points = ellipse.points.map((p) => ({ x: p.x + 10, y: p.y + 20 }));
  ellipse.points[1].x += 15;
  const source = await PDFDocument.load(imported.bytes),
    saved = await PDFDocument.load(
      await saveEditablePdf(imported.bytes, imported.state, viewer(source)),
    );
  assert.equal(annots(saved)[0].lookup(k("Subtype")).toString(), "/Circle");
  const result = (await readEditablePdf(await saved.save())).state.entities[0];
  assert.equal(result.type, "ellipse");
  for (let i = 0; i < 2; i++)
    for (const axis of ["x", "y"])
      assert.ok(
        Math.abs(result.points[i][axis] - ellipse.points[i][axis]) < 1e-7,
      );
  assert.ok(
    Math.abs(result.points[1].x - result.points[0].x) >
      Math.abs(before[1].x - before[0].x),
  );
});

test("ellipse geometry and fill round-trip on rotated, cropped, scaled pages with private metadata removed", async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const doc = await document();
    doc.getPage(0).setCropBox(10, 20, 150, 220);
    doc.getPage(0).setRotation(degrees(rotation));
    doc.getPage(0).node.set(k("UserUnit"), PDFNumber.of(2));
    const ellipse = {
      ...entity("ellipse"),
      points: [
        { x: 20, y: 30 },
        { x: 110, y: 80 },
      ],
      fillColor: "#00ff00",
    };
    const saved = await PDFDocument.load(
      await saveEditablePdf(
        await doc.save(),
        { entities: [ellipse], scales: {} },
        viewer(doc),
      ),
    );
    saved.catalog.delete(k("LiraPDF"));
    const result = (await readEditablePdf(await saved.save())).state
      .entities[0];
    assert.equal(result.type, "ellipse");
    assert.equal(result.fillColor, "#00ff00");
    for (const axis of ["x", "y"])
      assert.deepEqual(
        result.points.map((p) => p[axis]).sort((a, b) => a - b),
        ellipse.points.map((p) => p[axis]).sort((a, b) => a - b),
      );
  }
});

test("Lira arcs save as editable polylines and retain arc grips through external move and scale", async () => {
  const doc = await document(),
    bytes = await doc.save();
  const arc = {
    ...entity("arc"),
    points: [
      { x: 20, y: 100 },
      { x: 70, y: 40 },
      { x: 120, y: 100 },
    ],
  };
  const saved = await PDFDocument.load(
    await saveEditablePdf(bytes, { entities: [arc], scales: {} }, viewer(doc)),
  );
  const annotation = annots(saved)[0];
  assert.equal(annotation.lookup(k("Subtype")).toString(), "/PolyLine");
  assert.equal(annotation.lookup(k("Vertices")).size(), 130);
  assert.equal(annotation.lookup(k("F")).asNumber() & 128, 0);
  const original = (await readEditablePdf(await saved.save())).state
    .entities[0];
  assert.equal(original.type, "arc");
  for (let i = 0; i < 3; i++)
    assert.ok(
      Math.hypot(
        original.points[i].x - arc.points[i].x,
        original.points[i].y - arc.points[i].y,
      ) < 1e-7,
    );
  const vertices = annotation.lookup(k("Vertices"));
  annotation.set(
    k("Vertices"),
    saved.context.obj(
      vertices
        .asArray()
        .map((_, i) => vertices.lookup(i).asNumber() * 1.5 + (i % 2 ? -10 : 5)),
    ),
  );
  const moved = (await readEditablePdf(await saved.save())).state.entities[0];
  assert.equal(moved.type, "arc");
  assert.ok(Math.abs(moved.points[0].x - 35) < 1e-7);
  assert.ok(Math.abs(moved.points[0].y - 10) < 1e-7);
  const changed = annotation.lookup(k("Vertices"));
  changed.set(20, PDFNumber.of(changed.lookup(20).asNumber() + 5));
  const edited = (await readEditablePdf(await saved.save())).state.entities[0];
  assert.equal(edited.type, "polyline");
  assert.equal(edited.points.length, 65);
  saved.catalog.delete(k("LiraPDF"));
  assert.equal(
    (await readEditablePdf(await saved.save())).state.entities[0].type,
    "polyline",
  );
});

test("externally deleted arcs do not return from private state", async () => {
  const doc = await document();
  const arc = {
    ...entity("arc"),
    points: [
      { x: 20, y: 100 },
      { x: 70, y: 40 },
      { x: 120, y: 100 },
    ],
  };
  const saved = await PDFDocument.load(
    await saveEditablePdf(
      await doc.save(),
      { entities: [arc], scales: {} },
      viewer(doc),
    ),
  );
  saved.getPage(0).node.delete(k("Annots"));
  assert.equal(
    (await readEditablePdf(await saved.save())).state.entities.length,
    0,
  );
});

test("legacy v3 flattened arcs migrate to native annotations once", async () => {
  const source = await document(),
    bytes = await source.save(),
    doc = await PDFDocument.load(bytes);
  const arc = {
    ...entity("arc"),
    points: [
      { x: 20, y: 100 },
      { x: 70, y: 40 },
      { x: 120, y: 100 },
    ],
  };
  doc.catalog.set(
    k("LiraPDF"),
    doc.context.obj({
      Version: 3,
      Source: doc.context.register(doc.context.flateStream(bytes)),
      State: doc.context.register(
        doc.context.flateStream(
          JSON.stringify({ entities: [arc], scales: {} }),
        ),
      ),
    }),
  );
  const imported = await readEditablePdf(await doc.save());
  assert.equal(imported.state.entities[0].type, "arc");
  const saved = await saveEditablePdf(
    imported.bytes,
    imported.state,
    viewer(source),
  );
  assert.equal(annots(await PDFDocument.load(saved)).length, 1);
  assert.equal((await readEditablePdf(saved)).state.entities.length, 1);
});

test("new freehand saves as unlocked Ink with pen metadata and editable coordinates", async () => {
  const doc = await document();
  const ink = {
    ...entity("freehand"),
    points: [
      { x: 20, y: 30 },
      { x: 40, y: 20 },
      { x: 70, y: 60 },
    ],
    opacity: 0.6,
  };
  const saved = await PDFDocument.load(
    await saveEditablePdf(
      await doc.save(),
      { entities: [ink], scales: {} },
      viewer(doc),
    ),
  );
  const annotation = annots(saved)[0];
  assert.equal(annotation.lookup(k("Subtype")).toString(), "/Ink");
  assert.equal(annotation.lookup(k("Subj")).decodeText(), "Penna");
  assert.equal(annotation.lookup(k("Contents")).decodeText(), "~");
  assert.equal(annotation.lookup(k("F")).asNumber(), 4);
  saved.catalog.delete(k("LiraPDF"));
  annotation.set(
    k("InkList"),
    saved.context.obj([[25, 270, 45, 280, 75, 240]]),
  );
  const reopened = (await readEditablePdf(await saved.save())).state
    .entities[0];
  assert.equal(reopened.type, "freehand");
  assert.deepEqual(
    reopened.points,
    ink.points.map((p) => ({ ...p, x: p.x + 5 })),
  );
  assert.equal(reopened.opacity, 0.6);
});
