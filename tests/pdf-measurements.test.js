import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFHexString,
  degrees,
  decodePDFRawStream,
} from "pdf-lib";
import { readEditablePdf, saveEditablePdf } from "../src/editable-pdf.js";
import { exportPdf } from "../src/export.js";
import { annotationCoordinates } from "../src/pdf/annotation-coordinates.js";
import {
  measureDictionary,
  readMeasureScale,
} from "../src/pdf/measurement-format.js";
import {
  entityScale,
  changeViewportScale,
  mmPerPoint,
} from "../src/viewports.js";
import { distance } from "../src/model/geometry.js";

const k = PDFName.of;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
const style = { color: "#147b60", width: 1.2, fontSize: 12, opacity: 0.7 };
const dim = (id = "dim", page = 1, extra = {}) => ({
  id,
  type: "dim",
  page,
  points: [
    { x: 50, y: 60 },
    { x: 150, y: 60 },
    { x: 100, y: 110 },
  ],
  ...style,
  ...extra,
});
const region = () => ({
  id: "viewport",
  type: "viewport",
  page: 1,
  points: [
    { x: 20, y: 30 },
    { x: 200, y: 180 },
  ],
  denominator: 50,
  name: "Detalj ÅÄÖ",
  showLabel: false,
  ...style,
});
function viewer(doc) {
  return {
    getPage: async (n) => {
      const page = doc.getPage(n - 1),
        m = annotationCoordinates(page),
        o = m.fromPdf(0, 0),
        x = m.fromPdf(1, 0),
        y = m.fromPdf(0, 1),
        a = x.x - o.x,
        b = x.y - o.y,
        c = y.x - o.x,
        d = y.y - o.y,
        det = a * d - b * c;
      return {
        rotate: page.getRotation().angle,
        userUnit: m.unit,
        getViewport: () => ({
          convertToPdfPoint: (px, py) => [
            (d * (px - o.x) - c * (py - o.y)) / det,
            (-b * (px - o.x) + a * (py - o.y)) / det,
          ],
        }),
      };
    },
  };
}
async function source(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return doc;
}
const annots = (doc, page = 0) =>
  (doc.getPage(page).node.Annots()?.asArray() || []).map((ref) =>
    doc.context.lookup(ref, PDFDict),
  );
const viewports = (doc, page = 0) =>
  (doc.getPage(page).node.lookup(k("VP"))?.asArray() || []).map((ref) =>
    doc.context.lookup(ref, PDFDict),
  );
function assertMeasure(measure, conversion) {
  assert.equal(measure.lookup(k("Subtype")).toString(), "/RL");
  for (const name of ["X", "D", "A"]) {
    const format = measure.lookup(k(name)).lookup(0, PDFDict);
    assert.ok(format.lookup(k("U")).decodeText());
    near(format.lookup(k("C")).asNumber(), name === "X" ? conversion : 1);
  }
  near(readMeasureScale(measure), conversion);
}

test("dimensions and page/viewport scales are public PDF measurement objects without the Lira catalog", async () => {
  const doc = await source(2),
    state = {
      entities: [
        region(),
        dim("detail", 1, { viewportId: "viewport" }),
        dim("paper", 2),
      ],
      scales: { 1: 5, 2: 12 },
    };
  const saved = await PDFDocument.load(
    await saveEditablePdf(await doc.save(), state, viewer(doc)),
  );
  assert.equal(annots(saved).length, 1);
  assert.equal(annots(saved, 1).length, 1);
  const annotation = annots(saved)[0];
  assert.equal(annotation.lookup(k("Subtype")).toString(), "/Line");
  assert.equal(annotation.lookup(k("IT")).toString(), "/LineDimension");
  assert.equal(annotation.lookup(k("Cap")).asBoolean(), true);
  assert.ok(annotation.lookup(k("Contents")).decodeText().endsWith(" mm"));
  assert.ok(annotation.lookup(k("AP"), PDFDict).lookup(k("N")));
  assertMeasure(annotation.lookup(k("Measure"), PDFDict), 50 * mmPerPoint);
  assert.equal(viewports(saved).length, 2);
  assertMeasure(viewports(saved)[0].lookup(k("Measure"), PDFDict), 5);
  assertMeasure(viewports(saved, 1)[0].lookup(k("Measure"), PDFDict), 12);
  saved.catalog.delete(k("LiraPDF"));
  const reopened = await readEditablePdf(await saved.save());
  assert.equal(
    reopened.state.entities.filter((e) => e.type === "dim").length,
    2,
  );
  assert.equal(
    reopened.state.entities.filter((e) => e.type === "viewport").length,
    1,
  );
  assert.deepEqual(reopened.state.scales, state.scales);
  const dimension = reopened.state.entities.find((e) => e.id === "detail");
  near(
    entityScale(dimension, reopened.state.entities, reopened.state.scales),
    50 * mmPerPoint,
  );
  near(distance(...dimension.points.slice(0, 2)), 100);
});

test("repeated saving and reopening retains dimensions, distinct page scales, viewport identity and geometry", async () => {
  let doc = await source(2),
    bytes = await doc.save(),
    state = {
      entities: [
        region(),
        dim("detail", 1, { viewportId: "viewport" }),
        dim("paper", 2),
      ],
      scales: { 1: 5, 2: 12 },
      rotations: { 2: 90 },
    };
  for (let round = 0; round < 3; round++) {
    const saved = await saveEditablePdf(
      bytes,
      state,
      viewer(await PDFDocument.load(bytes)),
    );
    const current = await PDFDocument.load(saved);
    assert.equal(annots(current).length, 1);
    assert.equal(annots(current, 1).length, 1);
    assert.equal(viewports(current).length, 2);
    const reopened = await readEditablePdf(saved);
    const actual = reopened.state.entities.find((e) => e.id === "detail");
    for (let i = 0; i < 3; i++)
      for (const axis of ["x", "y"])
        near(actual.points[i][axis], dim().points[i][axis]);
    assert.equal(
      reopened.state.entities.find((e) => e.id === "viewport").name,
      "Detalj ÅÄÖ",
    );
    assert.equal(
      reopened.state.entities.find((e) => e.id === "viewport").denominator,
      50,
    );
    assert.deepEqual(reopened.state.scales, { 1: 5, 2: 12 });
    assert.deepEqual(reopened.state.rotations, { 2: 90 });
    ({ bytes, state } = reopened);
  }
});

test("external edits to measurement coordinates and calibration replace private state; deleted viewports do not return", async () => {
  const doc = await source(),
    state = {
      entities: [region(), dim("dim", 1, { viewportId: "viewport" })],
      scales: { 1: 5 },
    };
  const saved = await PDFDocument.load(
    await saveEditablePdf(await doc.save(), state, viewer(doc)),
  );
  const annotation = annots(saved)[0],
    coordinates = annotation
      .lookup(k("L"))
      .asArray()
      .map((n) => n.asNumber());
  annotation.set(
    k("L"),
    saved.context.obj(coordinates.map((n, i) => n + (i % 2 ? 20 : 10))),
  );
  annotation.set(k("Measure"), measureDictionary(saved, 3));
  const vp = viewports(saved)[0];
  vp.set(k("Measure"), measureDictionary(saved, 7));
  saved.getPage(0).node.set(k("VP"), saved.context.obj([vp]));
  const reopened = await readEditablePdf(await saved.save());
  assert.equal(
    reopened.state.entities.filter((e) => e.type === "viewport").length,
    0,
  );
  assert.equal(reopened.state.scales[1], 7);
  const actual = reopened.state.entities[0];
  near(actual.points[0].x, 60);
  near(actual.points[0].y, 40);
  assert.equal(actual.viewportId, undefined);
  assert.equal(actual.measurementScale, 3);
  const again = await PDFDocument.load(
    await saveEditablePdf(
      reopened.bytes,
      reopened.state,
      viewer(await PDFDocument.load(reopened.bytes)),
    ),
  );
  assert.equal(annots(again).length, 1);
  assert.equal(viewports(again).length, 1);
  assertMeasure(annots(again)[0].lookup(k("Measure"), PDFDict), 3);
});

test("externally deleted measurements and page scales are not resurrected from version 8 metadata", async () => {
  const doc = await source(),
    saved = await PDFDocument.load(
      await saveEditablePdf(
        await doc.save(),
        { entities: [dim()], scales: { 1: 5 } },
        viewer(doc),
      ),
    );
  saved.getPage(0).node.delete(k("Annots"));
  saved.getPage(0).node.delete(k("VP"));
  const result = await readEditablePdf(await saved.save());
  assert.deepEqual(result.state.entities, []);
  assert.deepEqual(result.state.scales, {});
});

test("a calibration-only PDF imports without annotations or private metadata", async () => {
  const doc = await source();
  doc.getPage(0).node.set(
    k("VP"),
    doc.context.obj([
      {
        Type: "Viewport",
        BBox: [0, 0, 300, 400],
        Measure: measureDictionary(doc, 6),
      },
    ]),
  );
  const result = await readEditablePdf(await doc.save());
  assert.deepEqual(result.state.scales, { 1: 6 });
  assert.deepEqual(result.state.entities, []);
  assert.equal(
    (await PDFDocument.load(result.bytes)).getPage(0).node.has(k("VP")),
    false,
  );
});

test("native measurement geometry and units survive crop, page rotation and UserUnit", async () => {
  for (const rotation of [0, 90, 180, 270])
    for (const unit of [1, 2, 5]) {
      const doc = await source();
      doc.getPage(0).setCropBox(10, 20, 250, 350);
      doc.getPage(0).setRotation(degrees(rotation));
      doc.getPage(0).node.set(k("UserUnit"), PDFNumber.of(unit));
      const original = dim(),
        saved = await PDFDocument.load(
          await saveEditablePdf(
            await doc.save(),
            { entities: [original], scales: { 1: 4 } },
            viewer(doc),
          ),
        );
      assertMeasure(annots(saved)[0].lookup(k("Measure"), PDFDict), 4 * unit);
      saved.catalog.delete(k("LiraPDF"));
      const result = await readEditablePdf(await saved.save());
      const actual = result.state.entities.find((e) => e.type === "dim");
      for (let i = 0; i < 2; i++)
        for (const axis of ["x", "y"])
          near(actual.points[i][axis], original.points[i][axis]);
      near(actual.measurementScale, 4);
      near(result.state.scales[1], 4);
    }
});

test("legacy flattened v7 dimensions migrate once to native annotations", async () => {
  const sourceDoc = await source(),
    bytes = await sourceDoc.save(),
    state = { entities: [dim()], scales: { 1: 5 } };
  const doc = await PDFDocument.load(
    await exportPdf(
      bytes,
      state.entities,
      state.scales,
      viewer(sourceDoc),
      {},
      { measurements: false },
    ),
  );
  doc.catalog.set(
    k("LiraPDF"),
    doc.context.obj({
      Version: 7,
      Source: doc.context.register(doc.context.flateStream(bytes)),
      State: doc.context.register(
        doc.context.flateStream(JSON.stringify(state)),
      ),
    }),
  );
  const legacy = await readEditablePdf(await doc.save());
  assert.equal(legacy.state.entities.length, 1);
  assert.equal(legacy.state.entities[0].type, "dim");
  const saved = await saveEditablePdf(
    legacy.bytes,
    legacy.state,
    viewer(sourceDoc),
  );
  assert.equal(annots(await PDFDocument.load(saved)).length, 1);
  assert.equal((await readEditablePdf(saved)).state.entities.length, 1);
});

test("unsupported anisotropic/geospatial viewports remain intact when supported marks round-trip", async () => {
  const doc = await source(),
    measure = measureDictionary(doc, 5);
  measure.set(
    k("Y"),
    doc.context.obj([{ U: PDFHexString.fromText("mm"), C: 8 }]),
  );
  measure.set(k("CYX"), PDFNumber.of(1));
  assert.equal(readMeasureScale(measure), null);
  doc.getPage(0).node.set(
    k("VP"),
    doc.context.obj([
      {
        Type: "Viewport",
        BBox: [0, 0, 300, 400],
        Name: PDFHexString.fromText("Unequal axes"),
        Measure: measure,
        CustomValue: PDFHexString.fromText("keep"),
      },
    ]),
  );
  const saved = await saveEditablePdf(
    await doc.save(),
    { entities: [dim("dim", 1, { measurementScale: 2 })], scales: {} },
    viewer(doc),
  );
  const result = await readEditablePdf(saved),
    base = await PDFDocument.load(result.bytes),
    retained = viewports(base)[0];
  assert.equal(retained.lookup(k("CustomValue")).decodeText(), "keep");
  assert.equal(readMeasureScale(retained.lookup(k("Measure"), PDFDict)), null);
});

test("inch/foot calibration converts to model millimetres without applying distance conversion twice", async () => {
  const doc = await source();
  const measure = doc.context.obj({
    Subtype: "RL",
    R: PDFHexString.fromText("1 in = 10 ft"),
    X: [{ U: PDFHexString.fromText("ft"), C: 10 / 72 }],
    D: [{ U: PDFHexString.fromText("in"), C: 12 }],
    A: [{ U: PDFHexString.fromText("sq ft"), C: 1 }],
  });
  near(readMeasureScale(measure), (10 / 72) * 304.8);
});

test("resizing a viewport keeps imported native dimension values constant", async () => {
  const state = {
    entities: [
      region(),
      dim("dim", 1, {
        viewportId: "viewport",
        measurementScale: 50 * mmPerPoint,
      }),
    ],
    scales: { 1: 5 },
  };
  const before =
      distance(...state.entities[1].points.slice(0, 2)) *
      entityScale(state.entities[1], state.entities, state.scales),
    changed = changeViewportScale(state, "viewport", 25),
    after = changed.entities[1];
  near(
    distance(...after.points.slice(0, 2)) *
      entityScale(after, changed.entities, changed.scales),
    before,
  );
  near(after.measurementScale, 25 * mmPerPoint);
});

test("flattened viewing copies retain standard page and viewport calibration", async () => {
  const doc = await source(),
    bytes = await exportPdf(
      await doc.save(),
      [region(), dim()],
      { 1: 5 },
      viewer(doc),
    ),
    exported = await PDFDocument.load(bytes);
  assert.equal(annots(exported).length, 0);
  assert.equal(viewports(exported).length, 2);
  assertMeasure(viewports(exported)[0].lookup(k("Measure"), PDFDict), 5);
});

test("external dimension appearances and custom captions are preserved instead of replaced by stale Lira styling", async () => {
  const doc = await source(),
    saved = await PDFDocument.load(
      await saveEditablePdf(
        await doc.save(),
        { entities: [dim()], scales: { 1: 5 } },
        viewer(doc),
      ),
    );
  const annotation = annots(saved)[0];
  annotation.set(
    k("Contents"),
    PDFHexString.fromText("Special measurement note"),
  );
  annotation.set(
    k("AP"),
    saved.context.obj({
      N: saved.context.register(
        saved.context.flateStream("q 0 0 1 RG 2 w 0 0 m 100 50 l S Q", {
          Type: "XObject",
          Subtype: "Form",
          BBox: [0, 0, 100, 50],
          Resources: {},
        }),
      ),
    }),
  );
  const result = await readEditablePdf(await saved.save());
  assert.equal(result.state.entities[0].type, "pdfMarkup");
  assert.equal(result.state.entities[0].measurementScale, undefined);
  const again = await PDFDocument.load(
    await saveEditablePdf(
      result.bytes,
      result.state,
      viewer(await PDFDocument.load(result.bytes)),
    ),
  );
  const output = annots(again)[0];
  assert.equal(
    output.lookup(k("Contents")).decodeText(),
    "Special measurement note",
  );
  assertMeasure(output.lookup(k("Measure"), PDFDict), 5);
  assert.equal(
    new TextDecoder().decode(
      decodePDFRawStream(
        output.lookup(k("AP"), PDFDict).lookup(k("N")),
      ).decode(),
    ),
    "q 0 0 1 RG 2 w 0 0 m 100 50 l S Q",
  );
});

test("dimension authors, subjects and popup references survive saving; copies do not share popups", async () => {
  const doc = await source(),
    saved = await PDFDocument.load(
      await saveEditablePdf(
        await doc.save(),
        { entities: [dim()], scales: { 1: 5 } },
        viewer(doc),
      ),
    );
  const annotation = annots(saved)[0],
    ref = saved.getPage(0).node.Annots().get(0);
  annotation.set(k("T"), PDFHexString.fromText("Reviewer"));
  annotation.set(k("Subj"), PDFHexString.fromText("Reference A"));
  const popup = saved.context.register(
    saved.context.obj({
      Type: "Annot",
      Subtype: "Popup",
      Rect: [0, 0, 100, 100],
      Parent: ref,
      P: saved.getPage(0).ref,
    }),
  );
  annotation.set(k("Popup"), popup);
  saved.getPage(0).node.addAnnot(popup);
  const result = await readEditablePdf(await saved.save());
  const copy = structuredClone(result.state.entities[0]);
  copy.id = "copy";
  copy.points = copy.points.map((p) => ({ x: p.x + 20, y: p.y + 30 }));
  result.state.entities.push(copy);
  const again = await PDFDocument.load(
    await saveEditablePdf(
      result.bytes,
      result.state,
      viewer(await PDFDocument.load(result.bytes)),
    ),
  );
  const marks = annots(again).filter(
    (a) => a.lookup(k("Subtype")).toString() === "/Line",
  );
  assert.equal(marks.length, 2);
  assert.equal(marks[0].lookup(k("T")).decodeText(), "Reviewer");
  assert.equal(marks[0].lookup(k("Subj")).decodeText(), "Reference A");
  assert.ok(marks[0].has(k("Popup")));
  assert.equal(marks[1].has(k("Popup")), false);
  const actualPopup = marks[0].lookup(k("Popup"), PDFDict);
  assert.equal(again.context.lookup(actualPopup.get(k("Parent"))), marks[0]);
  assert.equal(
    actualPopup.get(k("P")).toString(),
    again.getPage(0).ref.toString(),
  );
});

test("subpixel viewport regions remain native metadata instead of invalid editor objects", async () => {
  const doc = await source();
  doc.getPage(0).node.set(
    k("VP"),
    doc.context.obj([
      {
        Type: "Viewport",
        BBox: [10, 10, 10.2, 10.2],
        Measure: measureDictionary(doc, 5),
      },
    ]),
  );
  const saved = await saveEditablePdf(
    await doc.save(),
    { entities: [dim("dim", 1, { measurementScale: 2 })], scales: {} },
    viewer(doc),
  );
  const result = await readEditablePdf(saved);
  assert.equal(
    result.state.entities.some((e) => e.type === "viewport"),
    false,
  );
  assert.equal(viewports(await PDFDocument.load(result.bytes)).length, 1);
});

test("new dimensions keep the same own calibration before and after their first PDF save", async () => {
  const { createCreationController } =
    await import("../src/editor/create-tool-controller.js");
  const { createDocumentEditor } =
    await import("../src/editor/document-editor.js");
  const session = {
      state: { entities: [], scales: { 1: 5 } },
      undoStack: [],
      redoStack: [],
      pageCount: 1,
    },
    editor = createDocumentEditor(session),
    interaction = { tool: "dim", points: [] };
  const noop = () => {};
  const creation = createCreationController({
    interaction,
    session,
    workspace: { viewport: {}, pageNo: 1 },
    scaleContext: () => ({ scale: session.state.scales[1] }),
    clone: structuredClone,
    style: () => style,
    commit: editor.commit,
    clearTracking: noop,
    refresh: noop,
    toast: noop,
    error(e) {
      throw e;
    },
  });
  for (const p of dim().points) await creation.addPoint(p);
  const entity = session.state.entities[0];
  assert.equal(entity.measurementScale, 5);
  session.state.scales[1] = 10;
  assert.equal(
    entityScale(entity, session.state.entities, session.state.scales),
    5,
  );
  const doc = await source(),
    reopened = await readEditablePdf(
      await saveEditablePdf(await doc.save(), session.state, viewer(doc)),
    );
  assert.equal(reopened.state.scales[1], 10);
  assert.equal(reopened.state.entities[0].measurementScale, 5);
});

test("overlapping external viewport precedence and calibration survive import and resave", async () => {
  const { viewportAt } = await import("../src/viewports.js");
  const doc = await source();
  doc.getPage(0).node.set(
    k("VP"),
    doc.context.obj([
      {
        Type: "Viewport",
        Name: PDFHexString.fromText("Small first"),
        BBox: [50, 100, 150, 200],
        Measure: measureDictionary(doc, 50 * mmPerPoint),
      },
      {
        Type: "Viewport",
        Name: PDFHexString.fromText("Large last"),
        BBox: [20, 50, 200, 250],
        Measure: measureDictionary(doc, 100 * mmPerPoint),
      },
    ]),
  );
  const imported = await readEditablePdf(await doc.save());
  const hit = viewportAt(imported.state.entities, 1, { x: 100, y: 250 });
  assert.equal(hit.name, "Large last");
  near(hit.denominator, 100);
  const saved = await PDFDocument.load(
    await saveEditablePdf(
      imported.bytes,
      imported.state,
      viewer(await PDFDocument.load(imported.bytes)),
    ),
  );
  assert.deepEqual(
    viewports(saved).map((v) => v.lookup(k("Name")).decodeText()),
    ["Small first", "Large last"],
  );
  const again = await readEditablePdf(await saved.save());
  assert.equal(
    viewportAt(again.state.entities, 1, { x: 100, y: 250 }).name,
    "Large last",
  );
});

test("legacy dimensions without calibration retain their existing scale-1 displayed values", async () => {
  const doc = await source(),
    saved = await saveEditablePdf(
      await doc.save(),
      { entities: [dim()], scales: {} },
      viewer(doc),
    ),
    loaded = await PDFDocument.load(saved);
  assertMeasure(annots(loaded)[0].lookup(k("Measure"), PDFDict), 1);
  const result = await readEditablePdf(saved);
  assert.equal(result.state.entities[0].measurementScale, 1);
  assert.deepEqual(result.state.scales, {});
  assert.equal(annots(loaded)[0].lookup(k("Contents")).decodeText(), "100 mm");
});
