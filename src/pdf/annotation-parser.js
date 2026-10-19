import { PDFArray, PDFDict, PDFStream } from "pdf-lib";
import { key, value, number, numbers, text } from "./annotation-values.js";
import { annotationCoordinates } from "./annotation-coordinates.js";
import { blockCorners } from "../model/block-geometry.js";
import { isUnchangedCreatedMarkup } from "../pdf-created-markups.js";
import { arcPoints } from "../model/geometry.js";
import { parseDimensionAnnotation } from "./dimension-annotation.js";
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

export function parseAnnotation(annotation, page, pageNo, metadata, id) {
  const measured = parseDimensionAnnotation(
    annotation,
    page,
    pageNo,
    metadata,
    id,
  );
  if (measured) return measured;
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

export function parsePreservedMarkup(annotation, page, pageNo, metadata, id) {
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
  delete entity.measurementScale;
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
