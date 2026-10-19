import { PDFDict, PDFString, PDFHexString } from "pdf-lib";
import { key, archiveKey, number } from "./annotation-values.js";
import { annotationCoordinates } from "./annotation-coordinates.js";
import { createPdfStampAnnotation } from "../pdf-stamp.js";
import { createToolAnnotation } from "../pdf-created-markups.js";
import { markupRect, transformMarkup } from "../pdf-markup.js";
import { arcPoints } from "../model/geometry.js";
import { createDimensionAnnotation } from "./dimension-annotation.js";
import { entityScale } from "../viewports.js";
export const isStandardEntity = (entity) =>
  (entity.type === "block" && entity.isPdfStamp === true) ||
  [
    "line",
    "dim",
    "polyline",
    "rect",
    "circle",
    "ellipse",
    "arc",
    "freehand",
    "highlight",
    "cloud",
    "stamp",
    "pdfMarkup",
  ].includes(entity.type);

export async function writeAnnotations(
  doc,
  source,
  entities,
  pdf,
  scales = {},
) {
  const originals = doc.catalog.lookupMaybe(archiveKey, PDFDict);
  for (let i = 0; i < doc.getPageCount(); i++) {
    const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
    const unit = annotationCoordinates(source.getPage(i)).unit;
    const page = doc.getPage(i);
    for (const entity of entities.filter(
      (e) => e.page === i + 1 && isStandardEntity(e),
    )) {
      if (entity.type === "dim") {
        const originalRef = originals?.get(
          key(entity.pdfAnnotationId || entity.id),
        );
        const original = originalRef
          ? doc.context.lookup(originalRef, PDFDict)
          : null;
        const annotation = await createDimensionAnnotation(
          doc,
          page,
          entity,
          vp,
          // Legacy projects without calibration rendered dimensions at scale 1.
          // Preserve their existing displayed values when migrating to PDF measures.
          entityScale(entity, entities, scales) ?? 1,
          unit,
          original,
        );
        const reuse =
          originalRef && entity.id === (entity.pdfAnnotationId || entity.id);
        if (!reuse) annotation.delete(key("Popup"));
        const ref = reuse ? originalRef : doc.context.register(annotation);
        if (reuse) doc.context.assign(ref, annotation);
        page.node.addAnnot(ref);
        const popupRef = annotation.get(key("Popup"));
        if (popupRef) {
          const popup = doc.context.lookup(popupRef, PDFDict);
          popup.set(key("Parent"), ref);
          popup.set(key("P"), page.ref);
          page.node.addAnnot(popupRef);
        }
        continue;
      }
      if (
        ["cloud", "stamp"].includes(entity.type) ||
        (entity.type === "block" && entity.isPdfStamp)
      ) {
        const annotation =
          entity.type === "block"
            ? await createPdfStampAnnotation(doc, page, entity, vp)
            : await createToolAnnotation(doc, page, entity, vp, unit);
        const originalRef = originals?.get(
          key(entity.pdfAnnotationId || entity.id),
        );
        const original = originalRef
          ? doc.context.lookup(originalRef, PDFDict)
          : null;
        if (original)
          for (const [name, value] of original.entries())
            if (!annotation.has(name) || name.toString() === "/T")
              annotation.set(name, value);
        if (entity.id !== (entity.pdfAnnotationId || entity.id))
          annotation.delete(key("Popup"));
        const ref = doc.context.register(annotation);
        page.node.addAnnot(ref);
        const popupRef = annotation.get(key("Popup"));
        if (popupRef) {
          const popup = doc.context.lookup(popupRef, PDFDict);
          popup.set(key("Parent"), ref);
          popup.set(key("P"), page.ref);
          page.node.addAnnot(popupRef);
        }
        continue;
      }
      const originalRef = originals?.get(
        key(entity.pdfAnnotationId || entity.id),
      );
      const reuse =
        originalRef && entity.id === (entity.pdfAnnotationId || entity.id);
      const annotation = originalRef
        ? reuse
          ? doc.context.lookup(originalRef, PDFDict)
          : doc.context.lookup(originalRef, PDFDict).clone(doc.context)
        : doc.context.obj({
            Type: "Annot",
            T: PDFHexString.fromText("LiraPDF"),
          });
      if (!reuse) annotation.delete(key("Popup"));
      const annotationRef = reuse
        ? originalRef
        : doc.context.register(annotation);
      if (entity.type === "pdfMarkup") {
        if (!originalRef) throw Error("PDF-markeringens original saknas.");
        if (!reuse && annotation.has(key("BS")))
          annotation.set(
            key("BS"),
            annotation.lookup(key("BS"), PDFDict).clone(doc.context),
          );
        transformMarkup(annotation, doc, markupRect(entity, vp));
        annotation.set(key("NM"), PDFHexString.fromText(entity.id));
        annotation.set(key("P"), page.ref);
        page.node.addAnnot(annotationRef);
        const popupRef = annotation.get(key("Popup"));
        if (popupRef) {
          const popup = doc.context.lookup(popupRef, PDFDict);
          popup.set(key("Parent"), annotationRef);
          popup.set(key("P"), page.ref);
          page.node.addAnnot(popupRef);
        }
        continue;
      }
      const convert = (p) => vp.convertToPdfPoint(p.x, p.y);
      let points = (
        entity.type === "arc" ? arcPoints(...entity.points) : entity.points
      ).map(convert);
      if (entity.type === "rect") {
        const [a, b] = points;
        points = [
          [a[0], a[1]],
          [b[0], a[1]],
          [b[0], b[1]],
          [a[0], b[1]],
        ];
      }
      let circle;
      if (entity.type === "circle") {
        const [center, edge] = points,
          radius = Math.hypot(edge[0] - center[0], edge[1] - center[1]);
        circle = { center, radiusX: radius, radiusY: radius };
        points = [
          [center[0] - radius, center[1] - radius],
          [center[0] + radius, center[1] + radius],
        ];
      }
      if (entity.type === "ellipse") {
        const [a, b] = points;
        circle = {
          center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          radiusX: Math.abs(b[0] - a[0]) / 2,
          radiusY: Math.abs(b[1] - a[1]) / 2,
        };
      }
      const width = entity.width / unit,
        pad = Math.max(width / 2, 0.5);
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      const rect = [
        Math.min(...xs) - pad,
        Math.min(...ys) - pad,
        Math.max(...xs) + pad,
        Math.max(...ys) + pad,
      ];
      const color = [1, 3, 5].map(
        (index) => parseInt(entity.color.slice(index, index + 2), 16) / 255,
      );
      const subtype = {
        line: "Line",
        polyline: entity.closed ? "Polygon" : "PolyLine",
        rect: "Square",
        circle: "Circle",
        ellipse: "Circle",
        freehand: "Ink",
        highlight: "Ink",
        arc: "PolyLine",
      }[entity.type];
      const put = (name, data) =>
        annotation.set(key(name), doc.context.obj(data));
      for (const name of ["L", "Vertices", "InkList", "RD", "AP", "P"])
        annotation.delete(key(name));
      put("P", page.ref);
      put("Subtype", subtype);
      if (!annotation.has(key("Subj")))
        put(
          "Subj",
          PDFHexString.fromText(
            {
              line: "Linje",
              polyline: entity.closed ? "Polygon" : "Polylinje",
              rect: "Rektangel",
              circle: "Ellips",
              ellipse: "Ellips",
              arc: "Polylinje",
              freehand: "Penna",
              highlight: "Färgmarkering",
            }[entity.type],
          ),
        );
      if (entity.type === "freehand" && !annotation.has(key("Contents")))
        put("Contents", PDFString.of("~"));
      put("Rect", rect);
      put("C", color);
      const fill = entity.fillColor
        ? [1, 3, 5].map(
            (index) =>
              parseInt(entity.fillColor.slice(index, index + 2), 16) / 255,
          )
        : null;
      if (fill) put("IC", fill);
      else if (subtype !== "PolyLine") annotation.delete(key("IC"));
      if (entity.type === "highlight") put("BM", "Multiply");
      else annotation.delete(key("BM"));
      put("CA", entity.opacity ?? 1);
      put("BS", { Type: "Border", S: "S", W: width });
      put("Border", [0, 0, width]);
      put("NM", PDFHexString.fromText(entity.id));
      put(
        "M",
        PDFString.of(
          "D:" +
            new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) +
            "Z",
        ),
      );
      put("F", number(annotation, "F", 0) | 4);
      if (entity.type === "line") put("L", points.flat());
      if (["polyline", "arc"].includes(entity.type))
        put("Vertices", points.flat());
      if (["freehand", "highlight"].includes(entity.type))
        put("InkList", [points.flat()]);
      if (["rect", "circle", "ellipse"].includes(entity.type))
        put("RD", [pad, pad, pad, pad]);
      const n = (v) => Number(v.toFixed(6));
      let path = points
        .map(
          (p, j) =>
            `${n(p[0] - rect[0])} ${n(p[1] - rect[1])} ${j ? "l" : "m"}`,
        )
        .join("\n");
      if (circle) {
        const x = circle.center[0] - rect[0],
          y = circle.center[1] - rect[1],
          rx = circle.radiusX,
          ry = circle.radiusY,
          cx = rx * 0.5522847498307936,
          cy = ry * 0.5522847498307936;
        const command = (values, op) => values.map(n).join(" ") + " " + op;
        path = [
          command([x + rx, y], "m"),
          command([x + rx, y + cy, x + cx, y + ry, x, y + ry], "c"),
          command([x - cx, y + ry, x - rx, y + cy, x - rx, y], "c"),
          command([x - rx, y - cy, x - cx, y - ry, x, y - ry], "c"),
          command([x + cx, y - ry, x + rx, y - cy, x + rx, y], "c"),
        ].join("\n");
      }
      const closed =
        ["rect", "circle", "ellipse"].includes(entity.type) ||
        (entity.type === "polyline" && entity.closed);
      const appearance = `q /Opacity gs ${color.map(n).join(" ")} RG ${fill ? fill.map(n).join(" ") + " rg" : ""} ${n(width)} w ${["freehand", "highlight"].includes(entity.type) ? 1 : 0} J 1 j\n${path}\n${closed ? "h\n" : ""}${fill ? "B" : "S"} Q`;
      const stream = doc.context.flateStream(appearance, {
        Type: "XObject",
        Subtype: "Form",
        FormType: 1,
        BBox: [0, 0, rect[2] - rect[0], rect[3] - rect[1]],
        Resources: {
          ExtGState: {
            Opacity: {
              Type: "ExtGState",
              ...(entity.type === "highlight" ? { BM: "Multiply" } : {}),
              CA: entity.opacity ?? 1,
              ca: entity.opacity ?? 1,
            },
          },
        },
      });
      put("AP", { N: doc.context.register(stream) });
      page.node.addAnnot(annotationRef);
      const popupRef = annotation.get(key("Popup"));
      if (popupRef) {
        const popup = doc.context.lookup(popupRef, PDFDict);
        popup.set(key("Parent"), annotationRef);
        popup.set(key("P"), page.ref);
        page.node.addAnnot(popupRef);
      }
    }
  }
  doc.catalog.delete(archiveKey);
}
