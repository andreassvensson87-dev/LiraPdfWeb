import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { exportPdf } from "./export.js";
import { validateDocumentState } from "./model/document-validation.js";
import { importAnnotations } from "./pdf/annotation-import.js";
import { isStandardEntity, writeAnnotations } from "./pdf/annotation-writer.js";
import { pruneUnusedObjects } from "./pdf/object-graph.js";
import {
  importPageMeasurements,
  writePageMeasurements,
} from "./pdf/measurement-format.js";

const key = PDFName.of("LiraPDF");

export async function readEditablePdf(bytes) {
  const doc = await PDFDocument.load(bytes);
  let source = doc,
    sourceBytes = bytes,
    state = { entities: [], scales: {}, rotations: {} },
    version = 0;
  if (doc.catalog.has(key)) {
    const data = doc.catalog.lookup(key, PDFDict);
    version = data.lookup(PDFName.of("Version"), PDFNumber).asNumber();
    if (![1, 2, 3, 4, 5, 6, 7, 8].includes(version))
      throw Error(
        "PDF:en innehåller redigeringsdata från en version av LiraPDF som inte stöds.",
      );
    const stream = (name) =>
      decodePDFRawStream(data.lookup(PDFName.of(name), PDFRawStream)).decode();
    sourceBytes = stream("Source");
    state = JSON.parse(new TextDecoder().decode(stream("State")));
    validateDocumentState(state);
    source = await PDFDocument.load(sourceBytes);
    if (
      source.getPageCount() !== doc.getPageCount() ||
      state.entities.some((e) => e.page > source.getPageCount())
    )
      throw Error("PDF:ens sidor stämmer inte med dess redigeringsdata.");
  }
  const imported = importAnnotations(
    doc,
    source,
    version >= 2 ? state.entities : [],
  );
  // Standard annotations are authoritative, including external deletions.
  // Circles were flattened in v2 and arcs through v3; migrate their legacy state.
  const remaining =
    version >= 2
      ? state.entities.filter(
          (e) =>
            !isStandardEntity(e) ||
            (version <= 7 && e.type === "dim") ||
            (version === 2 && e.type === "circle") ||
            (version <= 3 && e.type === "arc"),
        )
      : state.entities;
  const ids = new Set(remaining.map((e) => e.id));
  for (const entity of imported.entities) {
    if (ids.has(entity.id)) entity.id = `pdf-${crypto.randomUUID()}`;
    ids.add(entity.id);
  }
  state.entities = [...remaining, ...imported.entities];
  const measurements = importPageMeasurements(doc, source, state, {
    authoritative: version >= 8,
  });
  if (!version && !imported.entities.length && !measurements.found) return null;
  // Native dimension scales remain valid when an external editor deletes a
  // viewport or moves an annotation outside its previous viewport/page.
  for (const entity of state.entities)
    if (
      entity.viewportId &&
      !state.entities.some(
        (v) =>
          v.type === "viewport" &&
          v.id === entity.viewportId &&
          v.page === entity.page,
      )
    )
      delete entity.viewportId;
  if (version >= 2) {
    state.rotations = {};
    for (let i = 0; i < doc.getPageCount(); i++) {
      const angle =
        (((doc.getPage(i).getRotation().angle -
          source.getPage(i).getRotation().angle) %
          360) +
          360) %
        360;
      if (angle) state.rotations[i + 1] = angle;
    }
  }
  // If an external editor moves part of a group to another page, split that group.
  const groups = new Map();
  for (const e of state.entities)
    if (e.groupId) {
      if (groups.has(e.groupId) && groups.get(e.groupId) !== e.page)
        delete e.groupId;
      else groups.set(e.groupId, e.page);
    }
  validateDocumentState(state);
  if (imported.changed || measurements.changed) pruneUnusedObjects(source);
  return {
    bytes:
      imported.changed || measurements.changed
        ? await source.save()
        : sourceBytes,
    state,
  };
}

export async function saveEditablePdf(bytes, state, pdf) {
  const source = await PDFDocument.load(bytes);
  const visible = await exportPdf(
    bytes,
    state.entities.filter((e) => !isStandardEntity(e)),
    state.scales,
    pdf,
    state.rotations || {},
    { measurements: false },
  );
  const doc = await PDFDocument.load(visible);
  await writeAnnotations(doc, source, state.entities, pdf, state.scales);
  await writePageMeasurements(doc, source, state, pdf);
  const original = doc.context.register(doc.context.flateStream(bytes));
  const editing = doc.context.register(
    doc.context.flateStream(new TextEncoder().encode(JSON.stringify(state))),
  );
  doc.catalog.set(
    key,
    doc.context.obj({ Version: 8, Source: original, State: editing }),
  );
  pruneUnusedObjects(doc);
  return doc.save();
}
