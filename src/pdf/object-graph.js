import { PDFArray, PDFDict, PDFRef, PDFStream } from "pdf-lib";
// Annotation references may lead back through Popup/Parent to their page.
// Map those pages to the existing destination pages instead of copying page trees.
export function annotationCopier(from, to) {
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
