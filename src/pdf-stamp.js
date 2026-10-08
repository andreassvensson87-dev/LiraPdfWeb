import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFTextField,
  PDFArray,
  PDFHexString,
} from "pdf-lib";
import { blockPage, blockCorners } from "./pdf-block.js";
import { drawMarkupAppearance } from "./pdf-markup.js";
import { appearanceHash } from "./markup-tools.js";
const k = PDFName.of;
export async function pdfStampFields(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc
    .getForm()
    .getFields()
    .filter((field) => field instanceof PDFTextField)
    .map((field) => ({ name: field.getName(), value: field.getText() || "" }));
}
export async function preparePdfStamp(bytes, attributes = {}) {
  const doc = await PDFDocument.load(bytes),
    form = doc.getForm();
  for (const field of form.getFields())
    if (
      field instanceof PDFTextField &&
      Object.hasOwn(attributes, field.getName())
    )
      field.setText(attributes[field.getName()]);
  if (form.getFields().length) form.flatten();
  for (const page of doc.getPages()) {
    for (const ref of page.node.Annots()?.asArray() || []) {
      const annotation = doc.context.lookup(ref);
      // pdf-lib flatten can leave references to widgets it has removed.
      if (!(annotation instanceof PDFDict)) continue;
      if (annotation.lookup(k("Subtype"))?.toString() === "/Popup") continue;
      const rect = annotation
        .lookup(k("Rect"), PDFArray)
        .asArray()
        .map((n) => n.asNumber());
      drawMarkupAppearance(doc, page, doc, annotation, rect);
    }
    page.node.delete(k("Annots"));
  }
  return blockPage(await doc.save(), 1);
}
export async function createPdfStampAnnotation(doc, page, entity, vp) {
  const bytes = Uint8Array.from(atob(entity.blockPdf), (c) => c.charCodeAt(0));
  const [embedded] = await doc.embedPdf(bytes, [0]);
  await embedded.embed();
  const points = blockCorners(entity).map((p) =>
      vp.convertToPdfPoint(p.x, p.y),
    ),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const origin = points[3],
    right = points[2],
    top = points[0],
    n = (v) => Number(v.toFixed(6));
  const matrix = [
    (right[0] - origin[0]) / embedded.width,
    (right[1] - origin[1]) / embedded.width,
    (top[0] - origin[0]) / embedded.height,
    (top[1] - origin[1]) / embedded.height,
    origin[0] - rect[0],
    origin[1] - rect[1],
  ]
    .map(n)
    .join(" ");
  const appearance = `q /Opacity gs ${matrix} cm /StampTemplate Do Q`;
  const stream = doc.context.flateStream(appearance, {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, rect[2] - rect[0], rect[3] - rect[1]],
    Resources: {
      XObject: { StampTemplate: embedded.ref },
      ExtGState: {
        Opacity: {
          Type: "ExtGState",
          CA: entity.opacity ?? 1,
          ca: entity.opacity ?? 1,
        },
      },
    },
  });
  return doc.context.obj({
    Type: "Annot",
    Subtype: "Stamp",
    Name: "LiraPDF",
    Rect: rect,
    F: 4,
    CA: entity.opacity ?? 1,
    P: page.ref,
    T: PDFHexString.fromText("LiraPDF"),
    Subj: PDFHexString.fromText(entity.blockName || "PDF-stämpel"),
    NM: PDFHexString.fromText(entity.id),
    AP: { N: doc.context.register(stream) },
    LiraCreatedAppearance: PDFHexString.fromText(appearanceHash(appearance)),
  });
}
