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
  const type = {
    "/Line": "line",
    "/PolyLine": "polyline",
    "/Polygon": "polyline",
    "/Square": "rect",
    "/Circle": "circle",
    "/Ink": "freehand",
  }[subtype];
  if (!type) return null;
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
  if (type === "freehand") {
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
  if (interior?.length) {
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
    if (!rx || Math.abs(rx - ry) > Math.max(0.0001, rx * 0.000001)) return null;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const old = metadata?.points;
    const angle =
      old?.length === 2
        ? Math.atan2(old[1].y - old[0].y, old[1].x - old[0].x)
        : 0;
    points.splice(0, 2, center, {
      x: center.x + rx * Math.cos(angle),
      y: center.y + rx * Math.sin(angle),
    });
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
          entity = parseAnnotation(original, page, i + 1, known.get(id), id);
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
  ["line", "polyline", "rect", "circle", "freehand"].includes(entity.type);

export async function writeAnnotations(doc, source, entities, pdf) {
  const originals = doc.catalog.lookupMaybe(archiveKey, PDFDict);
  for (let i = 0; i < doc.getPageCount(); i++) {
    const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
    const unit = annotationCoordinates(source.getPage(i)).unit;
    const page = doc.getPage(i);
    for (const entity of entities.filter(
      (e) => e.page === i + 1 && isStandardEntity(e),
    )) {
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
      const convert = (p) => vp.convertToPdfPoint(p.x, p.y);
      let points = entity.points.map(convert);
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
        circle = { center, radius };
        points = [
          [center[0] - radius, center[1] - radius],
          [center[0] + radius, center[1] + radius],
        ];
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
        freehand: "Ink",
      }[entity.type];
      const put = (name, data) =>
        annotation.set(key(name), doc.context.obj(data));
      for (const name of ["L", "Vertices", "InkList", "RD", "AP", "P"])
        annotation.delete(key(name));
      put("P", page.ref);
      put("Subtype", subtype);
      put("Rect", rect);
      put("C", color);
      const fill = entity.fillColor
        ? [1, 3, 5].map(
            (index) =>
              parseInt(entity.fillColor.slice(index, index + 2), 16) / 255,
          )
        : null;
      if (fill) put("IC", fill);
      else annotation.delete(key("IC"));
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
      if (entity.type === "polyline") put("Vertices", points.flat());
      if (entity.type === "freehand") put("InkList", [points.flat()]);
      if (["rect", "circle"].includes(entity.type))
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
          r = circle.radius,
          c = r * 0.5522847498307936;
        const command = (values, op) => values.map(n).join(" ") + " " + op;
        path = [
          command([x + r, y], "m"),
          command([x + r, y + c, x + c, y + r, x, y + r], "c"),
          command([x - c, y + r, x - r, y + c, x - r, y], "c"),
          command([x - r, y - c, x - c, y - r, x, y - r], "c"),
          command([x + c, y - r, x + r, y - c, x + r, y], "c"),
        ].join("\n");
      }
      const closed =
        ["rect", "circle"].includes(entity.type) ||
        (entity.type === "polyline" && entity.closed);
      const appearance = `q /Opacity gs ${color.map(n).join(" ")} RG ${fill ? fill.map(n).join(" ") + " rg" : ""} ${n(width)} w ${entity.type === "freehand" ? 1 : 0} J 1 j\n${path}\n${closed ? "h\n" : ""}${fill ? "B" : "S"} Q`;
      const stream = doc.context.flateStream(appearance, {
        Type: "XObject",
        Subtype: "Form",
        FormType: 1,
        BBox: [0, 0, rect[2] - rect[0], rect[3] - rect[1]],
        Resources: {
          ExtGState: {
            Opacity: {
              Type: "ExtGState",
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
