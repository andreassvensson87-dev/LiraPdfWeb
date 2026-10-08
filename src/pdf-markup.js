import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFObjectCopier,
  PDFString,
  PDFHexString,
  degrees,
} from "pdf-lib";
const k = PDFName.of;
const values = (a) =>
  a instanceof PDFArray
    ? a.asArray().map((_, i) => a.lookup(i, PDFNumber).asNumber())
    : null;
export function originalMarkup(doc, entity) {
  return doc.catalog
    .lookupMaybe(k("LiraAnnotationSources"), PDFDict)
    ?.lookupMaybe(k(entity.pdfAnnotationId || entity.id), PDFDict);
}
export function markupRect(entity, vp) {
  const points = entity.points.map((p) => vp.convertToPdfPoint(p.x, p.y));
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
// Draw the original Form XObject as a PDF reader maps its appearance to Rect.
// Only the on-screen preview is rasterized; saving and export keep vector data.
export function drawMarkupAppearance(doc, page, source, annotation, rect) {
  const ap = annotation.lookup(k("AP"), PDFDict).lookup(k("N"));
  if (!ap?.dict)
    throw Error("PDF-markeringen saknar ett utseende som kan visas.");
  const bbox = values(ap.dict.lookup(k("BBox"))),
    matrix = values(ap.dict.lookup(k("Matrix"))) || [1, 0, 0, 1, 0, 0];
  const corners = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[2], bbox[3]],
    [bbox[0], bbox[3]],
  ].map(([x, y]) => [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ]);
  const xs = corners.map((p) => p[0]),
    ys = corners.map((p) => p[1]),
    left = Math.min(...xs),
    bottom = Math.min(...ys);
  const sx = (rect[2] - rect[0]) / (Math.max(...xs) - left),
    sy = (rect[3] - rect[1]) / (Math.max(...ys) - bottom);
  if (![sx, sy].every((v) => Number.isFinite(v) && v > 0))
    throw Error("PDF-markeringen har ogiltiga gränser.");
  const form = PDFObjectCopier.for(source.context, doc.context).copy(ap);
  const name = page.node.newXObject("LiraMarkup", doc.context.register(form));
  const blend = annotation.lookup(k("BM"));
  let blendCommand = "";
  if (blend?.toString() === "/Multiply") {
    const gs = page.node.newExtGState(
      "LiraBlend",
      doc.context.register(
        doc.context.obj({ Type: "ExtGState", BM: "Multiply" }),
      ),
    );
    blendCommand = `${gs} gs `;
  }
  page.node.addContentStream(
    doc.context.register(
      doc.context.flateStream(
        `q ${blendCommand}${sx} 0 0 ${sy} ${rect[0] - sx * left} ${rect[1] - sy * bottom} cm ${name} Do Q`,
      ),
    ),
  );
}
export const loadMarkupSource = (bytes) => PDFDocument.load(bytes);
export async function markupPreviewPdf(bytes, entity) {
  const source =
      bytes instanceof PDFDocument ? bytes : await PDFDocument.load(bytes),
    original = originalMarkup(source, entity);
  if (!original) throw Error("PDF-markeringens original saknas.");
  const rect = values(original.lookup(k("Rect"))),
    doc = await PDFDocument.create(),
    page = doc.addPage([rect[2] - rect[0], rect[3] - rect[1]]);
  drawMarkupAppearance(doc, page, source, original, [
    0,
    0,
    rect[2] - rect[0],
    rect[3] - rect[1],
  ]);
  page.setRotation(
    degrees(source.getPage(entity.page - 1).getRotation().angle),
  );
  return doc.save();
}
// Keep the native geometry in step with the transformed appearance, so another
// editor can regenerate it. Imported special objects resize proportionally.
export function transformMarkup(annotation, doc, rect) {
  const old = values(annotation.lookup(k("Rect"))),
    sx = (rect[2] - rect[0]) / (old[2] - old[0]),
    sy = (rect[3] - rect[1]) / (old[3] - old[1]);
  const transform = (a) =>
    a.map((v, i) =>
      i % 2 ? rect[1] + (v - old[1]) * sy : rect[0] + (v - old[0]) * sx,
    );
  for (const name of ["L", "Vertices", "CL", "QuadPoints"]) {
    const a = values(annotation.lookup(k(name)));
    if (a) annotation.set(k(name), doc.context.obj(transform(a)));
  }
  const ink = annotation.lookup(k("InkList"));
  if (ink instanceof PDFArray)
    annotation.set(
      k("InkList"),
      doc.context.obj(
        ink.asArray().map((_, i) => transform(values(ink.lookup(i)))),
      ),
    );
  const scale = Math.sqrt(sx * sy),
    rd = values(annotation.lookup(k("RD")));
  if (rd)
    annotation.set(
      k("RD"),
      doc.context.obj(rd.map((v, i) => v * (i % 2 ? sy : sx))),
    );
  for (const name of ["LL", "LLE"]) {
    const value = annotation.lookup(k(name));
    if (value instanceof PDFNumber)
      annotation.set(k(name), PDFNumber.of(value.asNumber() * scale));
  }
  const bs = annotation.lookup(k("BS"));
  if (bs instanceof PDFDict) {
    const w = bs.lookup(k("W"));
    if (w instanceof PDFNumber)
      bs.set(k("W"), PDFNumber.of(w.asNumber() * scale));
  }
  // Keep FreeText font/layout metadata consistent when Bluebeam regenerates AP.
  if (Math.abs(scale - 1) > 1e-8) {
    for (const name of ["DA", "DS", "RC"]) {
      const text = annotation.lookup(k(name));
      if (text instanceof PDFString || text instanceof PDFHexString) {
        const updated =
          name === "DA"
            ? text
                .decodeText()
                .replace(
                  /([\d.]+)(\s+Tf\b)/g,
                  (_, size, op) => `${Number(size) * scale}${op}`,
                )
            : text
                .decodeText()
                .replace(
                  /([\d.]+)pt\b/g,
                  (_, size) => `${Number(size) * scale}pt`,
                );
        annotation.set(k(name), PDFHexString.fromText(updated));
      }
    }
  }
  annotation.set(k("Rect"), doc.context.obj(rect));
}
