import {
  PDFDict,
  PDFHexString,
  PDFString,
  StandardFonts,
  decodePDFRawStream,
} from "pdf-lib";
import { key, value, number, numbers, text } from "./annotation-values.js";
import { appearanceHash } from "../markup-tools.js";
import { annotationCoordinates } from "./annotation-coordinates.js";
import { measureDictionary, readMeasureScale } from "./measurement-format.js";
import { primitives } from "../model/entity-primitives.js";
import { dimension, distance } from "../model/geometry.js";

export async function createDimensionAnnotation(
  doc,
  page,
  entity,
  vp,
  scale,
  unit,
  original,
) {
  const annotation = original
    ? original.clone(doc.context)
    : doc.context.obj({ Type: "Annot", T: PDFHexString.fromText("LiraPDF") });
  const font = await doc.embedFont(StandardFonts.Helvetica),
    shapes = primitives(entity, scale);
  const convert = (p) => vp.convertToPdfPoint(p.x, p.y),
    points = [];
  for (const shape of shapes) {
    if (shape.kind === "line") points.push(convert(shape.a), convert(shape.b));
    if (shape.kind === "text") {
      const width = font.widthOfTextAtSize(shape.value, shape.size);
      for (const [x, y] of [
        [0, -shape.size],
        [width, -shape.size],
        [width, shape.size * 0.3],
        [0, shape.size * 0.3],
      ])
        points.push(convert({ x: shape.p.x + x, y: shape.p.y + y }));
    }
  }
  const pad = Math.max(1, entity.width) / unit;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const rect = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];
  const color = [1, 3, 5].map(
      (i) => parseInt(entity.color.slice(i, i + 2), 16) / 255,
    ),
    n = (v) => Number(v.toFixed(8));
  const local = (p) => {
    const a = convert(p);
    return `${n(a[0] - rect[0])} ${n(a[1] - rect[1])}`;
  };
  const origin = convert({ x: 0, y: 0 }),
    right = convert({ x: 1, y: 0 }),
    up = convert({ x: 0, y: -1 });
  const matrix = [
    (right[0] - origin[0]) * unit,
    (right[1] - origin[1]) * unit,
    (up[0] - origin[0]) * unit,
    (up[1] - origin[1]) * unit,
  ]
    .map(n)
    .join(" ");
  const appearance = [
    `q /Opacity gs ${color.map(n).join(" ")} RG ${color.map(n).join(" ")} rg ${n(entity.width / unit)} w 1 j`,
    ...shapes.map((shape) =>
      shape.kind === "line"
        ? `${local(shape.a)} m ${local(shape.b)} l S`
        : `BT /LiraDimensionFont ${n(shape.size / unit)} Tf ${matrix} ${local(shape.p)} Tm ${font.encodeText(shape.value)} Tj ET`,
    ),
    "Q",
  ].join("\n");
  const form = doc.context.flateStream(appearance, {
    Type: "XObject",
    Subtype: "Form",
    FormType: 1,
    BBox: [0, 0, rect[2] - rect[0], rect[3] - rect[1]],
    Resources: {
      Font: { LiraDimensionFont: font.ref },
      ExtGState: {
        Opacity: {
          Type: "ExtGState",
          CA: entity.opacity ?? 1,
          ca: entity.opacity ?? 1,
        },
      },
    },
  });
  const a = convert(entity.points[0]),
    b = convert(entity.points[1]),
    offset = convert(dimension(...entity.points).p);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ll =
    ((offset[0] - a[0]) * (b[1] - a[1]) - (offset[1] - a[1]) * (b[0] - a[0])) /
    len;
  for (const name of ["Vertices", "InkList", "RD", "BE", "CL"])
    annotation.delete(key(name));
  const put = (name, data) => annotation.set(key(name), doc.context.obj(data));
  put("Subtype", "Line");
  put("IT", "LineDimension");
  put("P", page.ref);
  put("Rect", rect);
  put("L", [...a, ...b]);
  put("LL", ll);
  put("LLE", 0);
  put("LLO", 0);
  put("LE", ["OpenArrow", "OpenArrow"]);
  put("Cap", true);
  put("CP", "Top");
  put("CO", [0, 0]);
  put("Measure", measureDictionary(doc, scale, unit));
  put(
    "Contents",
    PDFHexString.fromText(
      `${Number((distance(...entity.points.slice(0, 2)) * scale).toFixed(1))} mm`,
    ),
  );
  if (!annotation.has(key("Subj")))
    put("Subj", PDFHexString.fromText("Längdmått"));
  put("NM", PDFHexString.fromText(entity.id));
  put("C", color);
  put("IC", color);
  put("CA", entity.opacity ?? 1);
  put("BS", { Type: "Border", S: "S", W: entity.width / unit });
  put("Border", [0, 0, entity.width / unit]);
  put("F", number(annotation, "F", 0) | 4);
  put(
    "M",
    PDFString.of(
      "D:" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z",
    ),
  );
  put("AP", { N: doc.context.register(form) });
  put(
    "LiraDimensionAppearance",
    PDFHexString.fromText(appearanceHash(appearance)),
  );
  return annotation;
}

export function parseDimensionAnnotation(
  annotation,
  page,
  pageNo,
  metadata,
  id,
) {
  if (
    value(annotation, "Subtype")?.toString() !== "/Line" ||
    value(annotation, "IT")?.toString() !== "/LineDimension"
  )
    return null;
  const mapping = annotationCoordinates(page),
    scale = readMeasureScale(value(annotation, "Measure"), mapping.unit),
    ends = numbers(value(annotation, "L"));
  if (
    !scale ||
    !ends ||
    ends.length !== 4 ||
    number(annotation, "F", 0) & (1 | 2 | 8 | 16 | 32 | 64 | 128 | 512)
  )
    return null;
  const caption = text(value(annotation, "Contents"));
  if (caption && !/^[\s\d+.,-]+\s*(mm|cm|m|in|ft)\s*$/i.test(caption))
    return null;
  const hash = text(value(annotation, "LiraDimensionAppearance")),
    ap = value(annotation, "AP");
  if (hash) {
    const appearance = ap instanceof PDFDict ? value(ap, "N") : null;
    if (
      !appearance?.dict ||
      appearanceHash(
        new TextDecoder().decode(decodePDFRawStream(appearance).decode()),
      ) !== hash
    )
      return null;
  }
  // Unsupported caption/leader variants remain native PDF markups with their AP.
  if (
    number(annotation, "LLO", 0) ||
    number(annotation, "LLE", 0) ||
    number(annotation, "Rotate", 0) ||
    numbers(value(annotation, "CO"))?.some((n) => n !== 0)
  )
    return null;
  const [x1, y1, x2, y2] = ends,
    len = Math.hypot(x2 - x1, y2 - y1),
    ll = number(annotation, "LL", 0),
    border = value(annotation, "BS");
  const endings = value(annotation, "LE");
  if (
    endings &&
    (endings.size?.() !== 2 ||
      endings
        .asArray()
        .some((_, i) => endings.lookup(i)?.toString() !== "/OpenArrow"))
  )
    return null;
  if (
    border instanceof PDFDict &&
    value(border, "S") &&
    value(border, "S").toString() !== "/S"
  )
    return null;
  if (len < 1e-8 || !Number.isFinite(ll)) return null;
  const width =
      (border instanceof PDFDict ? number(border, "W", 1) : 1) * mapping.unit,
    opacity = number(annotation, "CA", 1),
    channels = numbers(value(annotation, "C")) || [0, 0, 0];
  if (
    width <= 0 ||
    width > 100 ||
    opacity < 0 ||
    opacity > 1 ||
    channels.length !== 3 ||
    channels.some((c) => c < 0 || c > 1)
  )
    return null;
  const color =
    "#" +
    channels
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const a = mapping.fromPdf(x1, y1),
    b = mapping.fromPdf(x2, y2),
    p = mapping.fromPdf(
      x1 + ((y2 - y1) / len) * ll,
      y1 - ((x2 - x1) / len) * ll,
    );
  const old = metadata?.points,
    dx = old?.[1]?.x - old?.[0]?.x,
    dy = old?.[1]?.y - old?.[0]?.y;
  const along =
    old?.length === 3 && dx * dx + dy * dy > 1e-12
      ? ((old[2].x - old[0].x) * dx + (old[2].y - old[0].y) * dy) /
        (dx * dx + dy * dy)
      : 0.5;
  return {
    ...(metadata || {}),
    id,
    type: "dim",
    page: pageNo,
    points: [
      a,
      b,
      { x: p.x + (b.x - a.x) * along, y: p.y + (b.y - a.y) * along },
    ],
    color,
    width,
    opacity,
    fontSize: metadata?.fontSize || 12,
    measurementScale: scale,
    pdfAnnotationId: id,
  };
}
