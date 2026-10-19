import { box } from "./geometry.js";
import { entityPointCounts } from "./entity-types.js";
export function validateDocumentState(p, { pageCount } = {}) {
  if (
    !p ||
    !Array.isArray(p.entities) ||
    !p.scales ||
    typeof p.scales !== "object" ||
    Array.isArray(p.scales)
  )
    throw Error("Ogiltig dokumentmodell.");
  if (
    p.rotations !== undefined &&
    (!p.rotations ||
      typeof p.rotations !== "object" ||
      Array.isArray(p.rotations) ||
      Object.entries(p.rotations).some(
        ([page, angle]) =>
          !/^[1-9]\d*$/.test(page) || ![0, 90, 180, 270].includes(angle),
      ))
  )
    throw Error("Ogiltig sidrotation.");
  for (const [page, s] of Object.entries(p.scales))
    if (!/^[1-9]\d*$/.test(page) || !Number.isFinite(s) || s <= 0)
      throw Error("Ogiltig skala.");
  const ids = new Set();
  const groupPages = new Map();
  for (const e of p.entities) {
    if (
      !e ||
      typeof e !== "object" ||
      !Object.hasOwn(entityPointCounts, e.type) ||
      !Number.isInteger(e.page) ||
      e.page < 1 ||
      typeof e.id !== "string" ||
      !e.id.length ||
      ids.has(e.id) ||
      !Array.isArray(e.points) ||
      (["polyline", "freehand", "highlight"].includes(e.type)
        ? e.points.length < (e.closed ? 3 : 2) ||
          e.points.length > 10000 ||
          (e.type === "polyline" && typeof e.closed !== "boolean")
        : e.points.length !== entityPointCounts[e.type]) ||
      e.points.some(
        (p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y),
      ) ||
      !/^#[0-9a-f]{6}$/i.test(e.color) ||
      (e.fillColor !== undefined &&
        (!/^#[0-9a-f]{6}$/i.test(e.fillColor) ||
          !(
            ["circle", "ellipse", "rect"].includes(e.type) ||
            (e.type === "polyline" && e.closed)
          ))) ||
      (e.opacity !== undefined &&
        (!Number.isFinite(e.opacity) || e.opacity < 0 || e.opacity > 1)) ||
      !Number.isFinite(e.width) ||
      e.width <= 0 ||
      e.width > 100 ||
      !Number.isFinite(e.fontSize) ||
      e.fontSize < 1 ||
      e.fontSize > 500 ||
      ("text" in e && typeof e.text !== "string")
    )
      throw Error("Projektet innehåller ogiltiga objekt.");
    if (
      e.measurementScale !== undefined &&
      (e.type !== "dim" ||
        !Number.isFinite(e.measurementScale) ||
        e.measurementScale <= 0)
    )
      throw Error("Ogiltig måttskala.");
    if (
      e.type === "pdfMarkup" &&
      (typeof e.pdfAnnotationId !== "string" ||
        !e.pdfAnnotationId.length ||
        e.pdfAnnotationId.length > 100 ||
        typeof e.label !== "string" ||
        typeof e.pdfSubtype !== "string" ||
        !["normal", "multiply"].includes(e.blendMode) ||
        box(...e.points).w <= 0 ||
        box(...e.points).h <= 0)
    )
      throw Error("Ogiltig originalmarkering.");
    if (
      e.type === "stamp" &&
      (typeof e.text !== "string" ||
        !e.text.trim() ||
        e.text.length > 100 ||
        /[\r\n]/.test(e.text))
    )
      throw Error(
        "Stämpeln behöver en text på högst 100 tecken utan radbrytning.",
      );
    if (
      ["cloud", "stamp"].includes(e.type) &&
      (box(...e.points).w < 1 || box(...e.points).h < 1)
    )
      throw Error("Markeringen behöver bredd och höjd.");
    if (
      e.type === "block" &&
      e.isPdfStamp !== undefined &&
      typeof e.isPdfStamp !== "boolean"
    )
      throw Error("Ogiltig PDF-stämpel.");
    if (e.groupId !== undefined) {
      if (
        typeof e.groupId !== "string" ||
        !e.groupId.length ||
        e.groupId.length > 100 ||
        e.type === "pdfErase" ||
        (groupPages.has(e.groupId) && groupPages.get(e.groupId) !== e.page)
      )
        throw Error("Ogiltig objektgrupp.");
      groupPages.set(e.groupId, e.page);
    }
    if (
      e.textAnchor &&
      (!Number.isFinite(e.textAnchor.x) || !Number.isFinite(e.textAnchor.y))
    )
      throw Error("Ogiltig textposition.");
    if (
      e.type === "block" &&
      (typeof e.blockPdf !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(e.blockPdf) ||
        typeof e.preview !== "string" ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(e.preview) ||
        ![e.blockWidth, e.blockHeight, e.naturalWidth, e.naturalHeight].every(
          (n) => Number.isFinite(n) && n > 0,
        ) ||
        !Number.isFinite(e.rotation))
    )
      throw Error("Projektet innehåller ett ogiltigt PDF-block.");
    if (
      e.type === "pdfErase" &&
      ((e.eraseOffset === undefined) === (e.eraseTextOffset === undefined) ||
        !Number.isSafeInteger(e.eraseOffset ?? e.eraseTextOffset) ||
        (e.eraseOffset ?? e.eraseTextOffset) < 0)
    )
      throw Error("Ogiltig PDF-redigering.");
    if (
      e.type === "viewport" &&
      (!Number.isFinite(e.denominator) ||
        e.denominator < 1 ||
        e.denominator > 100000 ||
        (e.name !== undefined &&
          (typeof e.name !== "string" || e.name.length > 100)) ||
        (e.showLabel !== undefined && typeof e.showLabel !== "boolean") ||
        box(...e.points).w < 1 ||
        box(...e.points).h < 1)
    )
      throw Error("Ogiltig viewport.");
    if (
      e.pdfViewportOrder !== undefined &&
      (e.type !== "viewport" ||
        !Number.isSafeInteger(e.pdfViewportOrder) ||
        e.pdfViewportOrder < 0)
    )
      throw Error("Ogiltig ordning för PDF-viewport.");
    if (
      e.viewportId !== undefined &&
      (typeof e.viewportId !== "string" ||
        ![
          "polyline",
          "freehand",
          "highlight",
          "line",
          "circle",
          "rect",
          "arc",
          "text",
          "leader",
          "dim",
          "block",
        ].includes(e.type))
    )
      throw Error("Ogiltig viewporttillhörighet.");
    ids.add(e.id);
  }
  for (const e of p.entities)
    if (
      e.viewportId &&
      !p.entities.some(
        (v) =>
          v.type === "viewport" && v.id === e.viewportId && v.page === e.page,
      )
    )
      throw Error("Objektets viewport saknas.");
  if (pageCount !== undefined) {
    if (!Number.isInteger(pageCount) || pageCount < 1)
      throw Error("Ogiltigt sidantal.");
    const pages = [
      ...p.entities.map((entity) => entity.page),
      ...Object.keys(p.scales).map(Number),
      ...Object.keys(p.rotations || {}).map(Number),
    ];
    if (pages.some((page) => page > pageCount))
      throw Error(
        "Dokumentets objekt eller inställningar hänvisar till sidor som saknas.",
      );
  }
  return p;
}
