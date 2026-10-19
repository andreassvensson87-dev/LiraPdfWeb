import { documentSnapshot } from "../document-state.js";

// Restoration is a workspace operation. One damaged saved document must not
// prevent other documents from opening, or disappear during the next autosave.
export async function restoreWorkspace({
  workspace,
  documents,
  readSaved,
  demoPdf,
  openDocument,
  activateDocument,
  emptyWorkspace,
  autosave,
  error,
}) {
  workspace.restoring = true;
  workspace.unrestoredDocuments = [];
  try {
    let saved;
    try {
      saved = await readSaved();
    } catch (exception) {
      workspace.recoveryBlocked = true;
      await emptyWorkspace();
      error(exception);
      return;
    }
    if (saved?.version === 2 && Array.isArray(saved.documents)) {
      let wanted = null;
      for (const snapshot of saved.documents) {
        try {
          const opened = await openDocument(
            snapshot.bytes,
            snapshot.name,
            snapshot.state,
            snapshot.fileHandle || null,
            { activate: false },
          );
          if (!opened)
            throw Error("Dokumentet kunde inte öppnas under återställning.");
          opened.savedState =
            snapshot.savedState ??
            documentSnapshot({ entities: [], scales: {} });
          opened.pageNo = Number.isInteger(snapshot.pageNo)
            ? Math.max(1, Math.min(opened.pdf.numPages, snapshot.pageNo))
            : 1;
          const view = snapshot.view;
          if (
            view &&
            Number.isFinite(view.zoom) &&
            view.zoom >= 0.1 &&
            view.zoom <= 8 &&
            Number.isFinite(view.pan?.x) &&
            Number.isFinite(view.pan?.y)
          )
            opened.view = structuredClone(view);
          if (snapshot.id === saved.activeId) wanted = opened.id;
        } catch (exception) {
          workspace.unrestoredDocuments.push(structuredClone(snapshot));
          error(exception);
        }
      }
      if (documents.length) await activateDocument(wanted || documents[0].id);
      else await emptyWorkspace();
    } else if (saved?.bytes) {
      try {
        await openDocument(saved.bytes, saved.name, saved);
      } catch (exception) {
        workspace.recoveryBlocked = true;
        await emptyWorkspace();
        error(exception);
      }
    } else if (saved !== undefined && saved !== null) {
      workspace.recoveryBlocked = true;
      await emptyWorkspace();
      error(
        Error(
          "Det sparade arbetsytformatet stöds inte. Sparade data har inte ersatts.",
        ),
      );
    } else await openDocument(await demoPdf(), "Exempelritning.pdf");
  } catch (exception) {
    workspace.recoveryBlocked = true;
    error(exception);
  } finally {
    workspace.restoring = false;
    if (!workspace.recoveryBlocked) autosave();
  }
}
