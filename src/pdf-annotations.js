import { createPdfStampAnnotation } from "./pdf-stamp.js";
import { blockCorners } from "./pdf-block.js";
import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFString,
  PDFHexString,
  PDFRef,
  PDFStream,
} from "pdf-lib";

import { markupRect, transformMarkup } from "./pdf-markup.js";
import {
  createToolAnnotation,
  isUnchangedCreatedMarkup,
} from "./pdf-created-markups.js";
import { arcPoints } from "./core.js";

// Annotation references may lead back through Popup/Parent to their page.
// Map those pages to the existing destination pages instead of copying page trees.
function annotationCopier(from, to) {
  const copies = new Map();
  for (let i = 0; i < from.getPageCount(); i++) {
    copies.set(from.getPage(i).ref, to.getPage(i).ref);
    copies.set(from.getPage(i).node, to.getPage(i).node);
  }
  copies.set(from.context.trailerInfo.Root, to.context.trailerInfo.Root);
  function copy(object) {
    if (copies.has(object)) return copies.get(object);
    if (object instanceof PDFRef) {
      const ref = to.context.nextRef();
      copies.set(object, ref);
      to.context.assign(ref, copy(from.context.lookup(object)));
      return ref;
    }
    const cloned = object.clone(to.context);
    copies.set(object, cloned);
    if (object instanceof PDFDict)
      for (const [key, child] of object.entries()) cloned.set(key, copy(child));
    else if (object instanceof PDFArray)
      for (let i = 0; i < object.size(); i++)
        cloned.set(i, copy(object.get(i)));
    else if (object instanceof PDFStream)
      for (const [key, child] of object.dict.entries())
        cloned.dict.set(key, copy(child));
    return cloned;
  }
  return { copy };
}

const key = (name) => PDFName.of(name);
const archiveKey = key("LiraAnnotationSources");
const value = (dict, name) => dict.lookup(key(name));
const number = (dict, name, fallback) => {
  const v = value(dict, name);
  return v instanceof PDFNumber ? v.asNumber() : fallback;
};
const numbers = (array) => {
  if (!(array instanceof PDFArray)) return null;
  const result = array.asArray().map((_, i) => array.lookup(i));
  return result.every(
    (v) => v instanceof PDFNumber && Number.isFinite(v.asNumber()),
  )
    ? result.map((v) => v.asNumber())
    : null;
};
const text = (v) =>
  v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : null;

// PDF.js's scale-1 viewport coordinates, including crop origin, rotation and UserUnit.
export function annotationCoordinates(page) {
  const media = page.getMediaBox(),
    crop = page.getCropBox();
  let left = Math.max(media.x, crop.x),
    bottom = Math.max(media.y, crop.y);
  let right = Math.min(media.x + media.width, crop.x + crop.width);
  let top = Math.min(media.y + media.height, crop.y + crop.height);
  if (right <= left || top <= bottom) {
    ({ x: left, y: bottom } = media);
    right = left + media.width;
    top = bottom + media.height;
  }
  const unit = number(page.node, "UserUnit", 1);
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return {
    unit,
    fromPdf(x, y) {
      const coordinates = {
        0: [x - left, top - y],
        90: [y - bottom, x - left],
        180: [right - x, y - bottom],
        270: [top - y, right - x],
      }[rotation];
      if (!coordinates) throw Error("Sidrotationen stöds inte.");
      return { x: coordinates[0] * unit, y: coordinates[1] * unit };
    },
  };
}

function annotationColor(channels) {
  let rgb;
  if (channels.length === 1) rgb = [channels[0], channels[0], channels[0]];
  else if (channels.length === 3) rgb = channels;
  else if (channels.length === 4)
    rgb = channels.slice(0, 3).map((v) => 1 - Math.min(1, v + channels[3]));
  else return null;
  if (rgb.some((v) => v < 0 || v > 1)) return null;
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function parseAnnotation(annotation, page, pageNo, metadata, id) {
  const subtype = value(annotation, "Subtype")?.toString();
  let type = {
    "/Line": "line",
    "/PolyLine": "polyline",
    "/Polygon": "polyline",
    "/Square": "rect",
    "/Circle": "circle",
    "/Ink": "freehand",
  }[subtype];
  if (!type) return null;
  if (
    type === "freehand" &&
    value(annotation, "BM")?.toString() === "/Multiply"
  )
    type = "highlight";
  if (
    value(annotation, "IT")?.toString() === "/CircleArc" ||
    annotation.has(key("Angle1")) ||
    annotation.has(key("Angle2")) ||
    (value(annotation, "BM") &&
      value(annotation, "BM").toString() !== "/Normal" &&
      type !== "highlight")
  )
    return null;
  const flags = number(annotation, "F", 0);
  // Preserve invisible, locked, measured and visually complex markups unchanged.
  if (
    flags & (1 | 2 | 8 | 16 | 32 | 64 | 128 | 512) ||
    annotation.has(key("Measure"))
  )
    return null;
  const ends = value(annotation, "LE");
  if (
    ends instanceof PDFArray &&
    ends.asArray().some((_, i) => ends.lookup(i)?.toString() !== "/None")
  )
    return null;
  const border = value(annotation, "BS");
  if (
    border instanceof PDFDict &&
    value(border, "S") &&
    value(border, "S").toString() !== "/S"
  )
    return null;
  const rawBorder = value(annotation, "Border");
  if (rawBorder instanceof PDFArray && rawBorder.size() > 3) {
    const dash = rawBorder.lookup(3);
    if (!(dash instanceof PDFArray) || dash.size()) return null;
  }
  const effect = value(annotation, "BE");
  if (effect instanceof PDFDict && value(effect, "S")?.toString() === "/C")
    return null;
  if (
    number(annotation, "LL", 0) ||
    number(annotation, "LLE", 0) ||
    number(annotation, "Rotate", 0)
  )
    return null;
  const legacyBorder = numbers(rawBorder);
  let coordinates;
  if (type === "line") coordinates = numbers(value(annotation, "L"));
  if (type === "polyline") coordinates = numbers(value(annotation, "Vertices"));
  if (["rect", "circle"].includes(type)) {
    const rect = numbers(value(annotation, "Rect")),
      inset = numbers(value(annotation, "RD")) || [0, 0, 0, 0];
    if (rect?.length === 4 && inset.length === 4)
      coordinates = [
        rect[0] + inset[0],
        rect[1] + inset[1],
        rect[2] - inset[2],
        rect[3] - inset[3],
      ];
  }
  if (["freehand", "highlight"].includes(type)) {
    const paths = value(annotation, "InkList");
    // Multi-stroke ink is preserved as an annotation until the editor supports multiple paths.
    if (!(paths instanceof PDFArray) || paths.size() !== 1) return null;
    coordinates = numbers(paths.lookup(0));
  }
  if (
    !coordinates ||
    coordinates.length % 2 ||
    coordinates.length < (subtype === "/Polygon" ? 6 : 4) ||
    coordinates.length > 20000 ||
    (["line", "rect", "circle"].includes(type) && coordinates.length !== 4)
  )
    return null;
  const mapping = annotationCoordinates(page);
  const width =
    (border instanceof PDFDict
      ? number(border, "W", 1)
      : (legacyBorder?.[2] ?? 1)) * mapping.unit;
  const opacity = number(annotation, "CA", 1);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    width > 100 ||
    opacity < 0 ||
    opacity > 1
  )
    return null;
  const channels = numbers(value(annotation, "C")) || [0, 0, 0];
  const color = annotationColor(channels);
  if (!color) return null;
  const interior = numbers(value(annotation, "IC"));
  if (annotation.has(key("IC")) && !interior) return null;
  let fillColor;
  // Bluebeam also writes IC on open PolyLine annotations. It does not fill
  // those paths (their appearance uses S), so retain it only as source metadata.
  if (interior?.length && subtype !== "/PolyLine") {
    if (!["rect", "circle"].includes(type) && subtype !== "/Polygon")
      return null;
    fillColor = annotationColor(interior);
    if (!fillColor) return null;
  }
  const points = [];
  for (let i = 0; i < coordinates.length; i += 2)
    points.push(mapping.fromPdf(coordinates[i], coordinates[i + 1]));
  if (type === "circle") {
    const [a, b] = points,
      rx = Math.abs(b.x - a.x) / 2,
      ry = Math.abs(b.y - a.y) / 2;
    if (!rx || !ry) return null;
    if (Math.abs(rx - ry) > Math.max(0.0001, rx * 0.000001)) type = "ellipse";
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const old = metadata?.points;
    const angle =
      old?.length === 2
        ? Math.atan2(old[1].y - old[0].y, old[1].x - old[0].x)
        : 0;
    if (type === "circle")
      points.splice(0, 2, center, {
        x: center.x + rx * Math.cos(angle),
        y: center.y + rx * Math.sin(angle),
      });
  }
  if (
    type === "polyline" &&
    subtype === "/PolyLine" &&
    metadata?.type === "arc"
  ) {
    const control = restoredArc(metadata.points, points);
    if (control) {
      type = "arc";
      points.splice(0, points.length, ...control);
    }
  }
  const entity = {
    ...(metadata || {}),
    id,
    page: pageNo,
    type,
    points,
    color,
    width,
    fontSize: metadata?.fontSize || 12,
    opacity,
    ...(type === "polyline" ? { closed: subtype === "/Polygon" } : {}),
    pdfAnnotationId: id,
    fillColor,
  };
  if (!fillColor) delete entity.fillColor;
  return entity;
}

function parsePreservedMarkup(annotation, page, pageNo, metadata, id) {
  if (
    ![
      "/FreeText",
      "/Line",
      "/PolyLine",
      "/Polygon",
      "/Square",
      "/Circle",
      "/Ink",
      "/Stamp",
      "/Highlight",
      "/Underline",
      "/StrikeOut",
      "/Squiggly",
    ].includes(value(annotation, "Subtype")?.toString())
  )
    return null;
  if (number(annotation, "F", 0) & (1 | 2 | 8 | 16 | 32 | 64 | 128 | 512))
    return null;
  const rect = numbers(value(annotation, "Rect")),
    ap = value(annotation, "AP");
  if (
    !rect ||
    rect.length !== 4 ||
    rect[2] <= rect[0] ||
    rect[3] <= rect[1] ||
    !(ap instanceof PDFDict)
  )
    return null;
  const appearance = value(ap, "N");
  if (
    !(appearance instanceof PDFStream) ||
    !numbers(value(appearance.dict, "BBox"))
  )
    return null;
  const bbox = numbers(value(appearance.dict, "BBox")),
    matrix = numbers(value(appearance.dict, "Matrix"));
  if (
    bbox.length !== 4 ||
    bbox[2] <= bbox[0] ||
    bbox[3] <= bbox[1] ||
    (appearance.dict.has(key("Matrix")) &&
      (!matrix ||
        matrix.length !== 6 ||
        Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) < 1e-12))
  )
    return null;
  if (
    value(annotation, "BM") &&
    !["/Normal", "/Multiply"].includes(value(annotation, "BM").toString())
  )
    return null;
  const mapping = annotationCoordinates(page);
  const entity = {
    ...(metadata || {}),
    id,
    page: pageNo,
    type: "pdfMarkup",
    points: [
      mapping.fromPdf(rect[0], rect[1]),
      mapping.fromPdf(rect[2], rect[3]),
    ],
    color: annotationColor(numbers(value(annotation, "C")) || []) || "#000000",
    width: Math.max(
      0.2,
      Math.min(
        100,
        number(
          value(annotation, "BS") instanceof PDFDict
            ? value(annotation, "BS")
            : annotation,
          "W",
          1,
        ) * mapping.unit,
      ),
    ),
    fontSize: 12,
    opacity: 1,
    pdfAnnotationId: id,
    pdfSubtype: value(annotation, "Subtype").toString().slice(1),
    label: text(value(annotation, "Subj")) || "PDF-markering",
    blendMode:
      value(annotation, "BM")?.toString() === "/Multiply"
        ? "multiply"
        : "normal",
  };
  delete entity.fillColor;
  if (
    metadata?.type === "block" &&
    metadata.isPdfStamp &&
    isUnchangedCreatedMarkup(annotation, metadata)
  ) {
    const corners = blockCorners(metadata),
      xs = corners.map((p) => p.x),
      ys = corners.map((p) => p.y),
      currentXs = entity.points.map((p) => p.x),
      currentYs = entity.points.map((p) => p.y);
    const width = Math.max(...currentXs) - Math.min(...currentXs),
      height = Math.max(...currentYs) - Math.min(...currentYs);
    if (
      Math.abs(width - (Math.max(...xs) - Math.min(...xs))) < 0.001 &&
      Math.abs(height - (Math.max(...ys) - Math.min(...ys))) < 0.001
    )
      return {
        ...metadata,
        id,
        page: pageNo,
        pdfAnnotationId: id,
        points: [
          {
            x: metadata.points[0].x + Math.min(...currentXs) - Math.min(...xs),
            y: metadata.points[0].y + Math.min(...currentYs) - Math.min(...ys),
          },
        ],
      };
  }
  if (
    isUnchangedCreatedMarkup(annotation, metadata) &&
    entity.color === metadata.color &&
    Math.abs(entity.width - metadata.width) < 1e-6 &&
    Math.abs(number(annotation, "CA", 1) - (metadata.opacity ?? 1)) < 1e-6
  ) {
    if (metadata.type === "cloud") {
      const vertices = numbers(value(annotation, "Vertices"));
      if (
        vertices?.length === 8 &&
        number(value(annotation, "BE"), "I", 0) === 2
      ) {
        const pts = [];
        for (let i = 0; i < 8; i += 2)
          pts.push(mapping.fromPdf(vertices[i], vertices[i + 1]));
        const xs = pts.map((p) => p.x),
          ys = pts.map((p) => p.y),
          minX = Math.min(...xs),
          maxX = Math.max(...xs),
          minY = Math.min(...ys),
          maxY = Math.max(...ys);
        if (
          new Set(pts.map((p) => `${p.x},${p.y}`)).size !== 4 ||
          pts.some(
            (p) => !([minX, maxX].includes(p.x) && [minY, maxY].includes(p.y)),
          )
        )
          return entity;
        entity.points = [
          {
            x: Math.min(...pts.map((p) => p.x)),
            y: Math.min(...pts.map((p) => p.y)),
          },
          {
            x: Math.max(...pts.map((p) => p.x)),
            y: Math.max(...pts.map((p) => p.y)),
          },
        ];
        entity.type = "cloud";
        entity.opacity = number(annotation, "CA", 1);
      }
    } else if (text(value(annotation, "Contents")) === metadata.text) {
      const inset = numbers(value(annotation, "LiraStampInset")) || [
        0, 0, 0, 0,
      ];
      entity.points = [
        mapping.fromPdf(rect[0] + inset[0], rect[1] + inset[1]),
        mapping.fromPdf(rect[2] - inset[2], rect[3] - inset[3]),
      ];
      entity.type = "stamp";
      entity.text = metadata.text;
      entity.fontSize = metadata.fontSize;
      entity.opacity = number(annotation, "CA", 1);
    }
  }
  return entity;
}

function restoredArc(control, actual) {
  const expected = arcPoints(...control);
  if (expected.length !== actual.length) return null;
  const a = expected[0],
    b = expected.at(-1),
    p = actual[0],
    q = actual.at(-1);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy;
  if (length < 1e-10) return null;
  const u = ((q.x - p.x) * dx + (q.y - p.y) * dy) / length;
  const v = ((q.y - p.y) * dx - (q.x - p.x) * dy) / length;
  const transform = (r) => ({
    x: p.x + u * (r.x - a.x) - v * (r.y - a.y),
    y: p.y + v * (r.x - a.x) + u * (r.y - a.y),
  });
  if (
    expected.some((r, i) => {
      const t = transform(r);
      return Math.hypot(t.x - actual[i].x, t.y - actual[i].y) > 0.001;
    })
  )
    return null;
  return control.map(transform);
}

// Supported marks become editor objects; other annotations remain on the PDF page.
// Copy from the current file, including external additions, edits and deletions.
export function importAnnotations(current, source, metadata = []) {
  const copier = annotationCopier(current, source);
  const archive = source.context.obj({});
  const entities = [],
    used = new Set();
  const known = new Map(metadata.map((e) => [e.id, e]));
  let changed = source.catalog.has(archiveKey);
  for (let i = 0; i < source.getPageCount(); i++) {
    const page = source.getPage(i),
      annots = current.getPage(i).node.Annots();
    const remaining = [],
      managed = new Set();
    for (const ref of annots?.asArray() || []) {
      const original = current.context.lookup(ref);
      let entity = null,
        id = original instanceof PDFDict ? text(value(original, "NM")) : null;
      if (!id || id.length > 100 || used.has(id))
        id = `pdf-${crypto.randomUUID()}`;
      if (original instanceof PDFDict) {
        try {
          entity =
            parseAnnotation(original, page, i + 1, known.get(id), id) ||
            parsePreservedMarkup(original, page, i + 1, known.get(id), id);
        } catch {
          /* Keep unfamiliar annotations visible. */
        }
      }
      const copy = copier.copy(ref);
      const copyRef =
        copy instanceof PDFRef ? copy : source.context.register(copy);
      if (entity) {
        used.add(id);
        managed.add(copyRef.toString());
        entities.push(entity);
        archive.set(key(id), copyRef);
        changed = true;
      } else remaining.push(copyRef);
    }
    if (current !== source && (annots?.size() || page.node.Annots()?.size()))
      changed = true;
    const visible = remaining.filter((ref) => {
      const annotation = source.context.lookup(ref);
      return !(
        annotation instanceof PDFDict &&
        value(annotation, "Subtype")?.toString() === "/Popup" &&
        managed.has(annotation.get(key("Parent"))?.toString())
      );
    });
    if (visible.length)
      page.node.set(key("Annots"), source.context.obj(visible));
    else page.node.delete(key("Annots"));
  }
  source.catalog.set(archiveKey, archive);
  return { entities, changed };
}

export const isStandardEntity = (entity) =>
  (entity.type === "block" && entity.isPdfStamp === true) ||
  [
    "line",
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

export async function writeAnnotations(doc, source, entities, pdf) {
  const originals = doc.catalog.lookupMaybe(archiveKey, PDFDict);
  for (let i = 0; i < doc.getPageCount(); i++) {
    const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
    const unit = annotationCoordinates(source.getPage(i)).unit;
    const page = doc.getPage(i);
    for (const entity of entities.filter(
      (e) => e.page === i + 1 && isStandardEntity(e),
    )) {
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

// Keep the internal source bounded across repeated round trips: old appearance
// streams and archived annotations otherwise remain as unreachable PDF objects.
export function pruneUnusedObjects(doc) {
  const visited = new Set();
  function visit(object) {
    if (object instanceof PDFRef) {
      const id = object.toString();
      if (visited.has(id)) return;
      visited.add(id);
      visit(doc.context.lookup(object));
    } else if (object instanceof PDFDict) {
      for (const [, child] of object.entries()) visit(child);
    } else if (object instanceof PDFArray) {
      for (const child of object.asArray()) visit(child);
    } else if (object instanceof PDFStream) visit(object.dict);
  }
  for (const root of Object.values(doc.context.trailerInfo)) visit(root);
  for (const [ref] of doc.context.enumerateIndirectObjects())
    if (!visited.has(ref.toString())) doc.context.delete(ref);
}
