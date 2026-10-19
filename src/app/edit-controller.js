import { createDocumentEditor } from "../editor/document-editor.js";

/** Coordinates edit effects. Document validation/history stay DOM-free. */
export function createEditController({
  session,
  workspace,
  interaction,
  updateChanges,
  refresh,
  autosave,
  showPage,
  view,
  closeObjectMenu,
  clearTracking,
}) {
  const editor = createDocumentEditor(session);
  function commit(next) {
    const { redrawPdf } = editor.commit(next);
    updateChanges();
    refresh();
    autosave();
    if (redrawPdf) return showPage(workspace.pageNo, true);
    else view();
  }
  function history(redo = false) {
    closeObjectMenu();
    interaction.activeGrip = null;
    if (workspace.busy) return;
    const hadPreview = !!interaction.drag;
    interaction.drag = null;
    interaction.hover = null;
    const result = editor.history(redo);
    if (!result) {
      if (hadPreview) refresh();
      return;
    }
    clearTracking();
    updateChanges();
    interaction.editOperation = null;
    interaction.tool = "select";
    interaction.selected = null;
    interaction.selection.clear();
    interaction.points = [];
    if (result.redrawPdf) showPage(workspace.pageNo, true);
    else view();
    refresh();
    autosave();
  }
  return { commit, history };
}
