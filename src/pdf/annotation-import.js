import { PDFDict, PDFRef } from "pdf-lib";
import { key, archiveKey, value, text } from "./annotation-values.js";
import { annotationCopier } from "./object-graph.js";
import { parseAnnotation, parsePreservedMarkup } from "./annotation-parser.js";
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
