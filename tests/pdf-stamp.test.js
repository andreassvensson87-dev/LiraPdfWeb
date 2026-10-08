import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";
import { pdfStampFields, preparePdfStamp } from "../src/pdf-stamp.js";
import { readEditablePdf, saveEditablePdf } from "../src/editable-pdf.js";
const k = PDFName.of;
const viewer = {
  getPage: async () => ({
    getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 400 - y] }),
  }),
};
const preview = "data:image/png;base64,iVBORw0KGgo=";
test("PDF stamp text fields resolve before stamping without changing the template", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([120, 60]);
  page.drawText("GRANSKAD", { x: 8, y: 40, size: 12 });
  const field = doc.getForm().createTextField("Granskare");
  field.addToPage(page, { x: 8, y: 8, width: 100, height: 20 });
  field.setText("Namn");
  const bytes = await doc.save();
  assert.deepEqual(await pdfStampFields(bytes), [
    { name: "Granskare", value: "Namn" },
  ]);
  const prepared = await preparePdfStamp(bytes, { Granskare: "Andreas" });
  assert.equal(prepared.width, 120);
  assert.equal(prepared.height, 60);
  const flattened = await PDFDocument.load(prepared.bytes);
  assert.equal(flattened.getForm().getFields().length, 0);
  assert.equal(flattened.getPage(0).node.Annots()?.size() || 0, 0);
  assert.equal(
    (await PDFDocument.load(bytes))
      .getForm()
      .getTextField("Granskare")
      .getText(),
    "Namn",
  );
});
test("PDF stamp markups in a template are retained when the PDF page becomes a stamp", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([120, 60]);
  page.drawText("MALL", { x: 8, y: 40, size: 12 });
  const appearance = doc.context.flateStream(
    "q 1 0 0 RG 2 w 0 0 m 100 20 l S Q",
    { Type: "XObject", Subtype: "Form", BBox: [0, 0, 100, 20], Resources: {} },
  );
  page.node.addAnnot(
    doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Line",
        Rect: [10, 10, 110, 30],
        L: [10, 10, 110, 30],
        F: 4,
        AP: { N: doc.context.register(appearance) },
      }),
    ),
  );
  const prepared = await preparePdfStamp(await doc.save()),
    flat = await PDFDocument.load(prepared.bytes);
  assert.ok(
    flat.getPage(0).node.Resources().lookup(k("XObject"), PDFDict).keys()
      .length,
  );
});
test("PDF templates save as native Stamp annotations with fixed natural size and restore placement", async () => {
  const template = await PDFDocument.create();
  template.addPage([120, 60]).drawText("GRANSKAD", { x: 8, y: 30, size: 12 });
  const block = await preparePdfStamp(await template.save());
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  const entity = {
    id: "pdf-stamp",
    type: "block",
    isPdfStamp: true,
    points: [{ x: 40, y: 80 }],
    page: 1,
    blockName: "Granskning",
    blockPdf: Buffer.from(block.bytes).toString("base64"),
    preview,
    naturalWidth: 120,
    naturalHeight: 60,
    blockWidth: 120,
    blockHeight: 60,
    rotation: 0,
    color: "#147b60",
    width: 1.2,
    fontSize: 12,
    opacity: 1,
  };
  const saved = await PDFDocument.load(
      await saveEditablePdf(
        await doc.save(),
        { entities: [entity], scales: {} },
        viewer,
      ),
    ),
    annotation = saved.getPage(0).node.Annots().lookup(0, PDFDict);
  assert.equal(annotation.lookup(k("Subtype")).toString(), "/Stamp");
  assert.deepEqual(
    annotation
      .lookup(k("Rect"))
      .asArray()
      .map((n) => n.asNumber()),
    [40, 260, 160, 320],
  );
  annotation.set(k("Rect"), saved.context.obj([50, 250, 170, 310]));
  const reopened = await readEditablePdf(await saved.save());
  assert.equal(reopened.state.entities[0].isPdfStamp, true);
  assert.deepEqual(reopened.state.entities[0].points, [{ x: 50, y: 90 }]);
  assert.equal(reopened.state.entities[0].blockWidth, 120);
  annotation.set(
    k("AP"),
    saved.context.obj({
      N: saved.context.register(
        saved.context.flateStream("q 0 0 1 RG 1 w 0 0 m 50 50 l S Q", {
          Type: "XObject",
          Subtype: "Form",
          BBox: [0, 0, 50, 50],
          Resources: {},
        }),
      ),
    }),
  );
  assert.equal(
    (await readEditablePdf(await saved.save())).state.entities[0].type,
    "pdfMarkup",
  );
});
