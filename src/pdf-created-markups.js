import {
  PDFName,
  PDFHexString,
  StandardFonts,
  decodePDFRawStream,
  PDFDict,
} from "pdf-lib";
import {
  cloudPoints,
  markupBox,
  appearanceHash,
  stampLayout,
} from "./markup-tools.js";
const k = PDFName.of;
export function isUnchangedCreatedMarkup(annotation, metadata) {
  if (
    !["cloud", "stamp"].includes(metadata?.type) &&
    !(metadata?.type === "block" && metadata.isPdfStamp)
  )
    return false;
  const ap = annotation.lookup(k("AP"));
  if (!(ap instanceof PDFDict)) return false;
  const stream = ap.lookup(k("N"));
  if (!stream?.dict) return false;
  const hash = annotation.lookup(k("LiraCreatedAppearance"))?.decodeText?.();
  return (
    hash ===
    appearanceHash(
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
  );
}
export async function createToolAnnotation(doc, page, entity, vp, unit = 1) {
  const convert = (p) => vp.convertToPdfPoint(p.x, p.y),
    r = markupBox(entity.points),
    width = entity.width / unit;
  const corners = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ].map(convert);
  const sampled =
    entity.type === "cloud" ? cloudPoints(entity.points).map(convert) : corners;
  const pad = width / 2 + 0.5,
    xs = sampled.map((p) => p[0]),
    ys = sampled.map((p) => p[1]),
    rect = [
      Math.min(...xs) - pad,
      Math.min(...ys) - pad,
      Math.max(...xs) + pad,
      Math.max(...ys) + pad,
    ];
  const color = [1, 3, 5].map(
      (i) => parseInt(entity.color.slice(i, i + 2), 16) / 255,
    ),
    n = (v) => Number(v.toFixed(6));
  const annotation = doc.context.obj({
    Type: "Annot",
    Subtype: entity.type === "cloud" ? "Polygon" : "Stamp",
    Rect: rect,
    F: 4,
    C: color,
    CA: entity.opacity ?? 1,
    BS: { Type: "Border", S: "S", W: width },
    NM: PDFHexString.fromText(entity.id),
    T: PDFHexString.fromText("LiraPDF"),
    Subj: PDFHexString.fromText(entity.type === "cloud" ? "Moln" : entity.text),
    P: page.ref,
  });
  const resources = {
    ExtGState: {
      Opacity: {
        Type: "ExtGState",
        CA: entity.opacity ?? 1,
        ca: entity.opacity ?? 1,
      },
    },
  };
  let path, appearance;
  if (entity.type === "cloud") {
    annotation.set(k("Vertices"), doc.context.obj(corners.flat()));
    annotation.set(k("BE"), doc.context.obj({ S: "C", I: 2 }));
    annotation.set(k("IT"), PDFName.of("PolygonCloud"));
    path = sampled
      .map(
        (p, i) => `${n(p[0] - rect[0])} ${n(p[1] - rect[1])} ${i ? "l" : "m"}`,
      )
      .join("\n");
    appearance = `q /Opacity gs ${color.map(n).join(" ")} RG ${n(width)} w 1 j\n${path}\nh S Q`;
  } else {
    const text = entity.text.trim(),
      font = await doc.embedFont(StandardFonts.HelveticaBold),
      w = rect[2] - rect[0],
      h = rect[3] - rect[1],
      inset = pad + 3;
    const size = stampLayout(entity).size / unit;
    const encoded = font.encodeText(text),
      baseline = convert({
        x: r.x + r.w / 2 - (font.widthOfTextAtSize(text, size) * unit) / 2,
        y: r.y + r.h / 2 + size * unit * 0.35,
      }),
      origin = convert({ x: 0, y: 0 }),
      right = convert({ x: 1, y: 0 }),
      up = convert({ x: 0, y: -1 });
    const textMatrix = [
      (right[0] - origin[0]) * unit,
      (right[1] - origin[1]) * unit,
      (up[0] - origin[0]) * unit,
      (up[1] - origin[1]) * unit,
      baseline[0] - rect[0],
      baseline[1] - rect[1],
    ]
      .map(n)
      .join(" ");
    resources.Font = { LiraStampFont: font.ref };
    annotation.set(k("Contents"), PDFHexString.fromText(text));
    annotation.set(k("Name"), PDFName.of("LiraPDF"));
    annotation.set(k("LiraStampInset"), doc.context.obj([pad, pad, pad, pad]));
    appearance = `q /Opacity gs ${color.map(n).join(" ")} RG ${color.map(n).join(" ")} rg ${n(width)} w ${n(pad)} ${n(pad)} ${n(w - 2 * pad)} ${n(h - 2 * pad)} re S BT /LiraStampFont ${n(size)} Tf ${textMatrix} Tm ${encoded} Tj ET Q`;
  }
  const form = doc.context.flateStream(appearance, {
    Type: "XObject",
    Subtype: "Form",
    FormType: 1,
    BBox: [0, 0, rect[2] - rect[0], rect[3] - rect[1]],
    Resources: resources,
  });
  annotation.set(k("AP"), doc.context.obj({ N: doc.context.register(form) }));
  annotation.set(
    k("LiraCreatedAppearance"),
    PDFHexString.fromText(appearanceHash(appearance)),
  );
  return annotation;
}
