import { validateDocumentState } from "../model/document-validation.js";
import { normalizeGroups } from "../groups.js";

export function removalKey(state) {
  return JSON.stringify(
    state.entities.filter((entity) => entity.type === "pdfErase"),
  );
}

/** The single owner of validation and undo/redo for the active document session.
 * Session replacement is an explicit workspace operation; edits are atomic.
 */
export function createDocumentEditor(session, { historyLimit = 80 } = {}) {
  return {
    commit(candidate) {
      const next = structuredClone(candidate);
      normalizeGroups(next.entities);
      validateDocumentState(next, { pageCount: session.pageCount });
      const redrawPdf = removalKey(session.state) !== removalKey(next);
      session.undoStack.push(structuredClone(session.state));
      if (session.undoStack.length > historyLimit) session.undoStack.shift();
      session.redoStack = [];
      session.state = next;
      return { redrawPdf };
    },
    history(redo = false) {
      const from = redo ? session.redoStack : session.undoStack;
      const to = redo ? session.undoStack : session.redoStack;
      if (!from.length) return null;
      const before = removalKey(session.state);
      to.push(structuredClone(session.state));
      session.state = from.pop();
      return { redrawPdf: before !== removalKey(session.state) };
    },
  };
}
