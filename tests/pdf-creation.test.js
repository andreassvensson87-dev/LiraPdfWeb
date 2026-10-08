import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFDict, degrees } from "pdf-lib";
import { readEditablePdf, saveEditablePdf } from "../src/editable-pdf.js";
import { annotationCoordinates } from "../src/pdf-annotations.js";
import { cloudPoints } from "../src/markup-tools.js";
const k = PDFName.of;
const entity = (type) => ({
  id: type,
  type,
  page: 1,
  points: [
    { x: 40, y: 60 },
    { x: 140, y: 100 },
  ],
  color: type === "highlight" ? "#ffff00" : "#b3261e",
  width: type === "highlight" ? 12 : 1.2,
  fontSize: 18,
  opacity: 0.75,
  ...(type === "stamp" ? { text: "GRANSKAD" } : {}),
});
const viewer = (doc) => ({
  getPage: async (n) => ({
    getViewport: () => {
      const m = annotationCoordinates(doc.getPage(n - 1)),
        o = m.fromPdf(0, 0),
        x = m.fromPdf(1, 0),
        y = m.fromPdf(0, 1),
        a = x.x - o.x,
        b = x.y - o.y,
        c = y.x - o.x,
        d = y.y - o.y,
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
test("new cloud, stamp and highlighter save as native objects and reopen with creation tools", async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).setRotation(degrees(rotation));
    const bytes = await doc.save();
    const objects = [entity("cloud"), entity("stamp"), entity("highlight")];
    const data = await saveEditablePdf(
        bytes,
        { entities: objects, scales: {} },
        viewer(doc),
      ),
      saved = await PDFDocument.load(data),
      annotations = saved
        .getPage(0)
        .node.Annots()
        .asArray()
        .map((ref) => saved.context.lookup(ref, PDFDict));
    assert.deepEqual(
      annotations.map((a) => a.lookup(k("Subtype")).toString()),
      ["/Polygon", "/Stamp", "/Ink"],
    );
    assert.equal(
      annotations[0].lookup(k("BE"), PDFDict).lookup(k("S")).toString(),
      "/C",
    );
    assert.equal(annotations[0].lookup(k("IT")).toString(), "/PolygonCloud");
    assert.equal(annotations[1].lookup(k("Contents")).decodeText(), "GRANSKAD");
    assert.equal(annotations[2].lookup(k("BM")).toString(), "/Multiply");
    const reopened = await readEditablePdf(data);
    assert.deepEqual(
      reopened.state.entities.map((e) => e.type),
      ["cloud", "stamp", "highlight"],
    );
    for (let i = 0; i < 3; i++) {
      assert.equal(reopened.state.entities[i].opacity, 0.75);
      assert.equal(reopened.state.entities[i].color, objects[i].color);
      assert.ok(
        Math.abs(
          reopened.state.entities[i].points[0].x - objects[i].points[0].x,
        ) < 1e-6 || rotation !== 0,
      );
    }
    const again = await PDFDocument.load(
      await saveEditablePdf(reopened.bytes, reopened.state, viewer(doc)),
    );
    assert.equal(again.getPage(0).node.Annots().size(), 3);
    saved.getPage(0).node.Annots().remove(0);
    assert.equal(
      (await readEditablePdf(await saved.save())).state.entities.length,
      2,
    );
    saved.catalog.delete(k("LiraPDF"));
    const independent = await readEditablePdf(await saved.save());
    assert.deepEqual(
      independent.state.entities.map((e) => e.type),
      ["pdfMarkup", "highlight"],
    );
  }
});
test("external appearance edits override cached cloud and stamp creation state", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  const saved = await PDFDocument.load(
    await saveEditablePdf(
      await doc.save(),
      { entities: [entity("cloud"), entity("stamp")], scales: {} },
      viewer(doc),
    ),
  );
  for (const ref of saved.getPage(0).node.Annots().asArray()) {
    const a = saved.context.lookup(ref, PDFDict);
    a.set(
      k("AP"),
      saved.context.obj({
        N: saved.context.register(
          saved.context.flateStream("q 0 0 1 RG 2 w 0 0 m 10 10 l S Q", {
            Type: "XObject",
            Subtype: "Form",
            BBox: [0, 0, 10, 10],
            Resources: {},
          }),
        ),
      }),
    );
  }
  assert.ok(
    (await readEditablePdf(await saved.save())).state.entities.every(
      (e) => e.type === "pdfMarkup",
    ),
  );
});
test("cloud outline has closed outward scallops and rejects flat rectangles", () => {
  const points = cloudPoints([
    { x: 20, y: 40 },
    { x: 120, y: 100 },
  ]);
  assert.deepEqual(points[0], points.at(-1));
  assert.ok(points.some((p) => p.y < 40));
  assert.ok(points.some((p) => p.x > 120));
  assert.throws(
    () =>
      cloudPoints([
        { x: 0, y: 0 },
        { x: 0, y: 20 },
      ]),
    /bredd/,
  );
});
