import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { exportPdf } from "./export.js";
import { validateProject } from "./core.js";

const key = PDFName.of("LiraPDF");

export async function readEditablePdf(bytes) {
  const doc = await PDFDocument.load(bytes);
  if (!doc.catalog.has(key)) return null;
  const data = doc.catalog.lookup(key, PDFDict);
  if (data.lookup(PDFName.of("Version"), PDFNumber).asNumber() !== 1)
    throw Error(
      "PDF:en innehåller redigeringsdata från en version av LiraPDF som inte stöds.",
    );
  const stream = (name) =>
    decodePDFRawStream(data.lookup(PDFName.of(name), PDFRawStream)).decode();
  const source = stream("Source");
  const state = JSON.parse(new TextDecoder().decode(stream("State")));
  validateProject({ ...state, format: "lirapdf", version: 1, pdf: "embedded" });
  const original = await PDFDocument.load(source);
  if (
    original.getPageCount() !== doc.getPageCount() ||
    state.entities.some((e) => e.page > original.getPageCount())
  )
    throw Error("PDF:ens sidor stämmer inte med dess redigeringsdata.");
  return { bytes: source, state };
}

export async function saveEditablePdf(bytes, state, pdf) {
  const visible = await exportPdf(
    bytes,
    state.entities,
    state.scales,
    pdf,
    state.rotations || {},
  );
  const doc = await PDFDocument.load(visible);
  const source = doc.context.register(doc.context.flateStream(bytes));
  const editing = doc.context.register(
    doc.context.flateStream(new TextEncoder().encode(JSON.stringify(state))),
  );
  doc.catalog.set(
    key,
    doc.context.obj({ Version: 1, Source: source, State: editing }),
  );
  return doc.save();
}
